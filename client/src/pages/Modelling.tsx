import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineUpload, HiOutlineChip, HiOutlineX, HiOutlineSparkles, HiOutlineLightningBolt, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Customers.css'

type ModelStatus = 'TRAINING' | 'TESTING' | 'ACTIVE' | 'ARCHIVED'
type ModelType = 'TRANSACTION_RISK' | 'CUSTOMER_RISK' | 'ANOMALY_DETECTION' | 'PATTERN_RECOGNITION' | 'NETWORK_ANALYSIS'

type MlModel = {
  id: number
  name: string
  model_type: ModelType
  version: string
  status: ModelStatus
  algorithm: string
  accuracy: number | null
  model_file_path: string
  updated_at: string
}

type DatasetItem = {
  dataset_file: string
  size_bytes: number
  uploaded_at: string
}

type ModelsResponse = { results?: MlModel[] } | MlModel[]
type DatasetsResponse = { results?: DatasetItem[] } | DatasetItem[]
type TrainResponse = {
  message: string
  name: string
  version: string
  metrics: { accuracy: number }
}

type ModellingVariant = 'use' | 'load' | 'calibration' | 'testing'

type ModellingProps = {
  variant?: ModellingVariant
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const SAMPLE_MODELS: MlModel[] = [
  {
    id: -1,
    name: 'Transaction Risk Baseline',
    model_type: 'TRANSACTION_RISK',
    version: '2026.03.01.090000',
    status: 'ACTIVE',
    algorithm: 'RANDOM_FOREST',
    accuracy: 0.932,
    model_file_path: 'media/ml_models/transaction-risk-baseline_v2026.03.01.090000.joblib',
    updated_at: '2026-03-01T09:00:00Z',
  },
  {
    id: -2,
    name: 'Transaction Risk Candidate A',
    model_type: 'TRANSACTION_RISK',
    version: '2026.03.02.114500',
    status: 'TESTING',
    algorithm: 'LOGISTIC_REGRESSION',
    accuracy: 0.887,
    model_file_path: 'media/ml_models/transaction-risk-candidate-a_v2026.03.02.114500.joblib',
    updated_at: '2026-03-02T11:45:00Z',
  },
  {
    id: -3,
    name: 'Transaction Risk Candidate B',
    model_type: 'TRANSACTION_RISK',
    version: '2026.03.03.081200',
    status: 'TRAINING',
    algorithm: 'RANDOM_FOREST',
    accuracy: null,
    model_file_path: 'media/ml_models/transaction-risk-candidate-b_v2026.03.03.081200.joblib',
    updated_at: '2026-03-03T08:12:00Z',
  },
]

function rowsOf<T>(payload: { results?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function fmtDate(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US')
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/failed to fetch/i.test(error.message)) {
      return `Unable to reach API at ${API_BASE_URL}. Check that backend is running and CORS allows this frontend origin.`
    }
    return error.message
  }
  return 'Unexpected request error.'
}

export const Modelling: React.FC<ModellingProps> = ({ variant = 'use' }) => {
  const PAGE_SIZE = 25
  const { token } = useAuth()
  const { showToast } = useToast()
  const [models, setModels] = useState<MlModel[]>([])
  const [datasets, setDatasets] = useState<DatasetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showTrainModal, setShowTrainModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showRecalibrateModal, setShowRecalibrateModal] = useState(false)
  const [toggleCandidate, setToggleCandidate] = useState<MlModel | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<MlModel | null>(null)
  const [renameCandidate, setRenameCandidate] = useState<MlModel | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [form, setForm] = useState({
    name: '',
    version: '1.0.0',
    algorithm: 'XGBoost',
    status: 'TESTING' as ModelStatus,
    model_file_path: '',
    accuracy: '',
    description: '',
  })

  const [trainForm, setTrainForm] = useState({
    name: 'Transaction Risk Model',
    algorithm: 'RANDOM_FOREST',
    test_size: '0.2',
    source: 'DATABASE',
    dataset_file: '',
  })

  const [uploadForm, setUploadForm] = useState({ dataset_name: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [recalibrateForm, setRecalibrateForm] = useState({
    model_id: '',
    algorithm: 'RANDOM_FOREST',
    test_size: '0.2',
    source: 'DATABASE',
    dataset_file: '',
  })

  const pageTitle =
    variant === 'load'
      ? 'Load Model'
      : variant === 'calibration'
      ? 'Model Calibration'
      : variant === 'testing'
        ? 'Testing Accuracy'
        : 'Select Models'
  const pageSubtitle =
    variant === 'load'
      ? 'Load an external or manually supplied transaction risk model into the system for later selection and approval.'
      : variant === 'calibration'
      ? 'Upload datasets, train models, and calibrate transaction risk scoring from the current data pipeline.'
      : variant === 'testing'
        ? 'Review accuracy performance and compare candidate transaction risk models before deployment.'
        : 'Load, review, and activate transaction risk models currently available in the system.'
  const showUploadAction = variant === 'calibration'
  const showTrainAction = variant === 'calibration'
  const showRecalibrateAction = variant === 'calibration'
  const showLoadAction = variant === 'load'

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) authHeaders.Authorization = `Token ${token}`

  const loadModels = async () => {
    const res = await fetch(`${API_BASE_URL}/ml-models/?model_type=TRANSACTION_RISK`, { headers: authHeaders })
    if (!res.ok) throw new Error('Failed to load models')
    const payload = (await res.json()) as ModelsResponse
    const apiModels = rowsOf(payload)
    setModels(apiModels.length ? apiModels : SAMPLE_MODELS)
  }

  const loadDatasets = async () => {
    const res = await fetch(`${API_BASE_URL}/ml-models/datasets/`, { headers: authHeaders })
    if (!res.ok) throw new Error('Failed to load datasets')
    const payload = (await res.json()) as DatasetsResponse
    const rows = rowsOf(payload)
    setDatasets(rows)
    return rows
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      await Promise.all([loadModels(), loadDatasets()])
    } catch (e) {
      setError(`${toUserErrorMessage(e)} Showing sample model data.`)
      setModels(SAMPLE_MODELS)
      setDatasets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const candidateModels = useMemo(
    () => models.filter((m) => m.status === 'TESTING' || m.status === 'TRAINING'),
    [models],
  )
  const selectableModels = useMemo(
    () => models.filter((m) => m.status === 'ACTIVE' || m.status === 'ARCHIVED'),
    [models],
  )
  const calibrationModels = useMemo(
    () => models.filter((m) => m.status !== 'ACTIVE'),
    [models],
  )
  const visibleModels = useMemo(() => {
    if (variant === 'testing') return candidateModels
    if (variant === 'calibration') return calibrationModels
    if (variant === 'load') return models
    return selectableModels
  }, [variant, candidateModels, calibrationModels, selectableModels])
  const filtered = useMemo(
    () => (statusFilter ? visibleModels.filter((m) => m.status === statusFilter) : visibleModels),
    [visibleModels, statusFilter],
  )
  const totalModels = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalModels / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageModels = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalModels === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageModels.length
  const blankRowCount = Math.max(PAGE_SIZE - pageModels.length, 0)

  const handleLoadModel = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const accuracy = form.accuracy.trim() ? Number(form.accuracy) : null
      const res = await fetch(`${API_BASE_URL}/ml-models/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: form.name.trim(),
          model_type: 'TRANSACTION_RISK',
          version: form.version.trim(),
          status: form.status,
          algorithm: form.algorithm.trim(),
          description: form.description.trim(),
          accuracy,
          training_data_size: 0,
          features_used: [],
          hyperparameters: {},
          model_file_path: form.model_file_path.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed to load model')
      const createdModel = (await res.json()) as MlModel
      setShowLoadModal(false)
      await loadModels()
      setNotice(null)
      if (variant === 'load' && createdModel?.id) {
        showToast(`Model loaded successfully. Approve ${createdModel.name} to move it into Select Models.`)
      } else {
        showToast('Model loaded successfully.')
      }
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDeploy = async (id: number) => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/ml-models/${id}/deploy/`, { method: 'POST', headers: authHeaders })
      if (!res.ok) throw new Error('Failed to deploy model')
      await loadModels()
      setNotice('Model deployed successfully.')
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleModel = async (model: MlModel) => {
    if (model.id < 0) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/ml-models/${model.id}/toggle_active/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to switch model state')
      const payload = (await res.json()) as { message?: string; model_name?: string; version?: string; status?: string }
      await loadModels()
      showToast(
        payload.message || `${model.name} v${model.version} is now ${model.status === 'ACTIVE' ? 'off' : 'on'}.`,
      )
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteModel = async (model: MlModel) => {
    if (model.id < 0) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/ml-models/${model.id}/`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Token ${token}` } : undefined,
      })
      if (!res.ok) throw new Error('Failed to delete model')
      await loadModels()
      showToast(`${model.name} v${model.version} deleted successfully.`)
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleRenameModel = async () => {
    if (!renameCandidate || renameCandidate.id < 0) return
    const nextName = renameValue.trim()
    if (!nextName) {
      setError('Model name is required.')
      return
    }

    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/ml-models/${renameCandidate.id}/`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ name: nextName }),
      })
      if (!res.ok) throw new Error('Failed to rename model')
      await loadModels()
      showToast(`Model renamed to ${nextName}.`)
      setRenameCandidate(null)
      setRenameValue('')
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleUploadDataset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      setError('Please choose a dataset file.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append('dataset_name', uploadForm.dataset_name.trim())
      fd.append('file', uploadFile)
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Token ${token}`
      const res = await fetch(`${API_BASE_URL}/ml-models/upload_dataset/`, { method: 'POST', headers, body: fd })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to upload dataset')
      }
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadForm({ dataset_name: '' })
      await loadDatasets()
      setNotice('Dataset uploaded successfully. Use Train Model to select it.')
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleTrainModel = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitTrainingRequest({
      name: trainForm.name.trim(),
      algorithm: trainForm.algorithm,
      testSize: Number(trainForm.test_size),
      source: trainForm.source,
      datasetFile: trainForm.dataset_file,
      successPrefix: 'Model trained successfully',
    })
  }

  const submitTrainingRequest = async ({
    name,
    algorithm,
    testSize,
    source,
    datasetFile,
    successPrefix,
  }: {
    name: string
    algorithm: string
    testSize: number
    source: string
    datasetFile: string
    successPrefix: string
  }) => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint = source === 'UPLOADED' ? `${API_BASE_URL}/ml-models/train_dataset/` : `${API_BASE_URL}/ml-models/train/`
      const payload =
        source === 'UPLOADED'
          ? {
              dataset_file: datasetFile,
              name,
              algorithm,
              test_size: testSize,
            }
          : {
              name,
              algorithm,
              test_size: testSize,
            }
      if (source === 'UPLOADED' && !datasetFile) {
        throw new Error('Choose an uploaded dataset first.')
      }
      const res = await fetch(endpoint, { method: 'POST', headers: authHeaders, body: JSON.stringify(payload) })
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}))
        throw new Error(errPayload?.error || 'Failed to train model')
      }
      const trained = (await res.json()) as TrainResponse
      setShowTrainModal(false)
      setShowRecalibrateModal(false)
      await loadModels()
      const toastMessage = `${successPrefix}: ${trained.name} v${trained.version} (accuracy ${(trained.metrics.accuracy * 100).toFixed(1)}%).`
      setNotice(null)
      showToast(toastMessage)
    } catch (e) {
      setError(toUserErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleRecalibrateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedModel = models.find((model) => String(model.id) === recalibrateForm.model_id)
    if (!selectedModel) {
      setError('Choose a model to recalibrate first.')
      return
    }

    await submitTrainingRequest({
      name: selectedModel.name,
      algorithm: recalibrateForm.algorithm,
      testSize: Number(recalibrateForm.test_size),
      source: recalibrateForm.source,
      datasetFile: recalibrateForm.dataset_file,
      successPrefix: 'Model recalibrated successfully',
    })
  }

  const openTrainModal = async () => {
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const latestDatasets = await loadDatasets()
      setTrainForm((p) => ({
        ...p,
        source: latestDatasets.length > 0 ? 'UPLOADED' : 'DATABASE',
        dataset_file: latestDatasets[0]?.dataset_file ?? '',
      }))
      setShowTrainModal(true)
    } catch (e) {
      setError(toUserErrorMessage(e))
      setShowTrainModal(true)
    } finally {
      setLoading(false)
    }
  }

  const openRecalibrateModal = async () => {
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const latestDatasets = await loadDatasets()
      const recalibrationTarget = candidateModels[0] ?? calibrationModels[0] ?? models[0]
      setRecalibrateForm({
        model_id: recalibrationTarget ? String(recalibrationTarget.id) : '',
        algorithm: recalibrationTarget?.algorithm || 'RANDOM_FOREST',
        test_size: '0.2',
        source: latestDatasets.length > 0 ? 'UPLOADED' : 'DATABASE',
        dataset_file: latestDatasets[0]?.dataset_file ?? '',
      })
      setShowRecalibrateModal(true)
    } catch (e) {
      setError(toUserErrorMessage(e))
      setShowRecalibrateModal(true)
    } finally {
      setLoading(false)
    }
  }

  const openApproveModal = (model: MlModel) => {
    setToggleCandidate(model)
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{pageTitle}</h1>
          <p className="customers-subtitle">{pageSubtitle}</p>
        </div>
        <div className="customers-header-actions">
          {showUploadAction && (
            <button type="button" className="btn-export-action btn-with-icon" onClick={() => setShowUploadModal(true)}>
              <HiOutlineUpload size={16} aria-hidden />
              <span>Upload Dataset</span>
            </button>
          )}
          {showTrainAction && (
            <button type="button" className="btn-secondary-action btn-with-icon" onClick={() => void openTrainModal()}>
              <HiOutlineSparkles size={16} aria-hidden />
              <span>Train Model</span>
            </button>
          )}
          {showRecalibrateAction && (
            <button type="button" className="btn-outline-action btn-with-icon" onClick={() => void openRecalibrateModal()}>
              <HiOutlineChip size={16} aria-hidden />
              <span>Recalibrate</span>
            </button>
          )}
          {showLoadAction && (
            <button type="button" className="btn-primary-action btn-with-icon" onClick={() => setShowLoadModal(true)}>
              <HiOutlineUpload size={16} aria-hidden />
              <span>Load Model</span>
            </button>
          )}
        </div>
      </header>

      <div className="customers-container">
        {variant === 'testing' && (
          <div className="customers-filters-card report-filters">
            <div className="bulk-import-card">
              <div className="view-profile-grid">
                <div className="view-profile-field">
                  <span className="view-profile-label">Candidate Models</span>
                  <span className="view-profile-value">{candidateModels.length}</span>
                </div>
                <div className="view-profile-field">
                  <span className="view-profile-label">Approved Models</span>
                  <span className="view-profile-value">{selectableModels.filter((m) => m.status === 'ACTIVE').length}</span>
                </div>
                <div className="view-profile-field view-profile-field-full">
                  <span className="view-profile-label">Workflow</span>
                  <span className="view-profile-value view-profile-value-block">
                    Review candidate model accuracy here. When the results are acceptable, approve the model so it moves into Select Models as the active production model.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {variant !== 'load' && (
          <div className="customers-filters-card report-filters">
            <div className="report-filters-left">
              {variant === 'calibration' && (
                <>
                  <div className="filter-group">
                    <span className="filter-label">Step 1:</span>
                    <span className="modal-value">Add dataset ({datasets.length})</span>
                  </div>
                  <div className="filter-group">
                    <span className="filter-label">Step 2:</span>
                    <span className="modal-value">Train or recalibrate</span>
                  </div>
                  <div className="filter-group">
                    <span className="filter-label">Step 3:</span>
                    <span className="modal-value">Send to testing</span>
                  </div>
                </>
              )}
              <div className="filter-group">
                <span className="filter-label">
                  {variant === 'testing'
                    ? 'Candidate Models:'
                    : variant === 'use'
                      ? 'Selected Models:'
                      : 'Uploaded Datasets:'}
                </span>
                <span className="modal-value">
                  {variant === 'testing'
                    ? candidateModels.length
                    : variant === 'use'
                      ? selectableModels.length
                      : datasets.length}
                </span>
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
                  <option value="TRAINING">TRAINING</option>
                  <option value="TESTING">TESTING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className={`customers-table-card-outer ${!error && !notice && pageModels.length === 0 ? 'table-empty-state' : ''}`}>
          {!error && !notice && pageModels.length === 0 && (
            <div className="table-empty-watermark" aria-hidden="true">
              <HiOutlineChip size={42} />
              <span>No Models</span>
            </div>
          )}
          <div className="report-content-container ecl-table-container">
            <table className="ecl-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>VERSION</th>
                  <th>ALGORITHM</th>
                  <th>STATUS</th>
                  <th>{variant === 'testing' ? 'TEST ACCURACY' : 'ACCURACY'}</th>
                  <th>MODEL PATH</th>
                  <th>UPDATED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr><td colSpan={8} className="muted">{error}</td></tr>
                ) : notice ? (
                  <tr><td colSpan={8} className="muted">{notice}</td></tr>
                ) : pageModels.length === 0 ? (
                  <tr><td colSpan={8} className="muted">{loading ? 'Loading models...' : 'No models loaded yet.'}</td></tr>
                ) : (
                  pageModels.map((m) => (
                    <tr key={m.id}>
                      <td className="customer-id">{m.name}</td>
                      <td>{m.version}</td>
                      <td>{m.algorithm}</td>
                      <td><span className={`pill ${m.status === 'ACTIVE' ? 'pill-kyc-verified' : 'pill-medium'}`}>{m.status}</span></td>
                      <td className="muted">{m.accuracy == null ? '-' : `${(m.accuracy * 100).toFixed(1)}%`}</td>
                      <td className="muted">{m.model_file_path || '-'}</td>
                      <td className="muted">{fmtDate(m.updated_at)}</td>
                      <td>
                        {variant === 'use' ? (
                          <div className="customers-actions">
                            <HiOutlinePencil
                              size={18}
                              className={`action-icon action-icon-edit ${loading || m.id < 0 ? 'action-icon-disabled' : ''}`}
                              onClick={() => {
                                if (loading || m.id < 0) return
                                setRenameCandidate(m)
                                setRenameValue(m.name)
                              }}
                              title="Rename model"
                              aria-label={`Rename ${m.name}`}
                            />
                            <HiOutlineLightningBolt
                              size={18}
                              className={`action-icon action-icon-view ${loading || m.id < 0 ? 'action-icon-disabled' : ''}`}
                              onClick={() => {
                                if (!(loading || m.id < 0)) setToggleCandidate(m)
                              }}
                              title={m.status === 'ACTIVE' ? 'Turn off model' : 'Turn on model'}
                              aria-label={m.status === 'ACTIVE' ? `Turn off ${m.name}` : `Turn on ${m.name}`}
                            />
                            <HiOutlineTrash
                              size={18}
                              className={`action-icon action-icon-delete ${loading || m.id < 0 ? 'action-icon-disabled' : ''}`}
                              onClick={() => {
                                if (!(loading || m.id < 0)) setDeleteCandidate(m)
                              }}
                              title="Delete model"
                              aria-label={`Delete ${m.name}`}
                            />
                          </div>
                        ) : variant === 'load' ? (
                          <div className="customers-actions">
                            <HiOutlineLightningBolt
                              size={18}
                              className={`action-icon action-icon-view ${loading || m.status === 'ACTIVE' || m.id < 0 ? 'action-icon-disabled' : ''}`}
                              onClick={() => setToggleCandidate(m)}
                              title={m.status === 'ACTIVE' ? 'Already approved' : 'Approve model'}
                              aria-label={m.status === 'ACTIVE' ? `Approved ${m.name}` : `Approve ${m.name}`}
                            />
                          </div>
                        ) : (
                          <div className="customers-actions">
                            {variant === 'calibration' ? (
                              <HiOutlineTrash
                                size={18}
                                className={`action-icon action-icon-delete ${loading || m.id < 0 ? 'action-icon-disabled' : ''}`}
                                onClick={() => {
                                  if (!(loading || m.id < 0)) setDeleteCandidate(m)
                                }}
                                title="Delete model"
                                aria-label={`Delete ${m.name}`}
                              />
                            ) : variant === 'testing' ? (
                              <button
                                type="button"
                                className="btn-primary-action"
                                onClick={() => openApproveModal(m)}
                                disabled={loading || m.status === 'ACTIVE' || m.id < 0}
                              >
                                Approve
                              </button>
                            ) : (
                              <span className="muted">No direct action</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )).concat(
                    Array.from({ length: blankRowCount }).map((_, index) => (
                      <tr key={`blank-row-${index}`} aria-hidden>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    )),
                  )
                )}
              </tbody>
            </table>
          </div>
          <div className="ecl-table-footer">
            <div className="table-footer-left">
              Showing {displayStart} to {displayEnd} of {totalModels} results.
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

      {showLoadModal && (
        <div className="modal-backdrop" onClick={() => setShowLoadModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><HiOutlineChip size={18} /> Load Transaction Model</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowLoadModal(false)} aria-label="Close"><HiOutlineX size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleLoadModel}>
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Model Name</label><input className="modal-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Version</label><input className="modal-input" value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} required /></div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Algorithm</label><input className="modal-input" value={form.algorithm} onChange={(e) => setForm((p) => ({ ...p, algorithm: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Status</label><select className="modal-input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ModelStatus }))}><option value="TRAINING">TRAINING</option><option value="TESTING">TESTING</option><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></div>
                </div>
                <div className="modal-field"><label className="modal-label">Model File Path</label><input className="modal-input" value={form.model_file_path} onChange={(e) => setForm((p) => ({ ...p, model_file_path: e.target.value }))} placeholder="models/transaction-risk-v1.pkl" /></div>
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Accuracy (0-1)</label><input type="number" step="0.001" min="0" max="1" className="modal-input" value={form.accuracy} onChange={(e) => setForm((p) => ({ ...p, accuracy: e.target.value }))} /></div>
                  <div className="modal-field"><label className="modal-label">Model Type</label><input className="modal-input" value="TRANSACTION_RISK" readOnly /></div>
                </div>
                <div className="modal-field"><label className="modal-label">Description</label><textarea className="modal-input modal-textarea" rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowLoadModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action" disabled={loading}>Load Model</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><HiOutlineUpload size={18} /> Upload Dataset</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowUploadModal(false)} aria-label="Close"><HiOutlineX size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleUploadDataset}>
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Dataset Name (optional)</label><input className="modal-input" value={uploadForm.dataset_name} onChange={(e) => setUploadForm({ dataset_name: e.target.value })} /></div>
                  <div className="modal-field"><label className="modal-label">Dataset File (.csv, .xlsx, .xls)</label><input type="file" className="modal-input" accept=".csv,.xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} required /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action" disabled={loading}>{loading ? 'Uploading...' : 'Upload Dataset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTrainModal && (
        <div className="modal-backdrop" onClick={() => setShowTrainModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><HiOutlineSparkles size={18} /> Train Transaction Model</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowTrainModal(false)} aria-label="Close"><HiOutlineX size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleTrainModel}>
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Model Name</label><input className="modal-input" value={trainForm.name} onChange={(e) => setTrainForm((p) => ({ ...p, name: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Algorithm</label><select className="modal-input" value={trainForm.algorithm} onChange={(e) => setTrainForm((p) => ({ ...p, algorithm: e.target.value }))}><option value="RANDOM_FOREST">RANDOM_FOREST</option><option value="LOGISTIC_REGRESSION">LOGISTIC_REGRESSION</option></select></div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Test Size (0.1 - 0.5)</label><input type="number" min="0.1" max="0.5" step="0.05" className="modal-input" value={trainForm.test_size} onChange={(e) => setTrainForm((p) => ({ ...p, test_size: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Training Source</label><select className="modal-input" value={trainForm.source} onChange={(e) => setTrainForm((p) => ({ ...p, source: e.target.value, dataset_file: e.target.value === 'UPLOADED' ? (datasets[0]?.dataset_file ?? '') : '' }))}><option value="DATABASE">DATABASE</option><option value="UPLOADED">UPLOADED DATASET</option></select></div>
                </div>
                {trainForm.source === 'UPLOADED' && (
                  <div className="modal-field">
                    <label className="modal-label">Choose Uploaded Dataset</label>
                    {datasets.length === 0 ? (
                      <>
                        <div className="muted">No uploaded datasets found. Upload one first, then train from it.</div>
                        <button
                          type="button"
                          className="btn-secondary-action"
                          onClick={() => {
                            setShowTrainModal(false)
                            setShowUploadModal(true)
                          }}
                        >
                          Open Upload Dataset
                        </button>
                      </>
                    ) : (
                      <select className="modal-input" value={trainForm.dataset_file} onChange={(e) => setTrainForm((p) => ({ ...p, dataset_file: e.target.value }))} required>
                        <option value="">Select dataset</option>
                        {datasets.map((d) => (
                          <option key={d.dataset_file} value={d.dataset_file}>{d.dataset_file} ({Math.round(d.size_bytes / 1024)} KB)</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowTrainModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action" disabled={loading}>{loading ? 'Training...' : 'Start Training'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecalibrateModal && (
        <div className="modal-backdrop" onClick={() => setShowRecalibrateModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><HiOutlineChip size={18} /> Recalibrate Model</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowRecalibrateModal(false)} aria-label="Close"><HiOutlineX size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleRecalibrateModel}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Model To Recalibrate</label>
                  <select
                    className="modal-input"
                    value={recalibrateForm.model_id}
                    onChange={(e) => setRecalibrateForm((p) => ({ ...p, model_id: e.target.value }))}
                    required
                  >
                    <option value="">Select model</option>
                    {calibrationModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} v{m.version}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label">Algorithm</label>
                    <select className="modal-input" value={recalibrateForm.algorithm} onChange={(e) => setRecalibrateForm((p) => ({ ...p, algorithm: e.target.value }))}>
                      <option value="RANDOM_FOREST">RANDOM_FOREST</option>
                      <option value="LOGISTIC_REGRESSION">LOGISTIC_REGRESSION</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Test Size</label>
                    <input type="number" min="0.1" max="0.5" step="0.05" className="modal-input" value={recalibrateForm.test_size} onChange={(e) => setRecalibrateForm((p) => ({ ...p, test_size: e.target.value }))} required />
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Calibration Source</label>
                  <select
                    className="modal-input"
                    value={recalibrateForm.source}
                    onChange={(e) => setRecalibrateForm((p) => ({
                      ...p,
                      source: e.target.value,
                      dataset_file: e.target.value === 'UPLOADED' ? (datasets[0]?.dataset_file ?? '') : '',
                    }))}
                  >
                    <option value="DATABASE">DATABASE</option>
                    <option value="UPLOADED">UPLOADED DATASET</option>
                  </select>
                </div>
                {recalibrateForm.source === 'UPLOADED' && (
                  <div className="modal-field">
                    <label className="modal-label">Choose Uploaded Dataset</label>
                    <select className="modal-input" value={recalibrateForm.dataset_file} onChange={(e) => setRecalibrateForm((p) => ({ ...p, dataset_file: e.target.value }))} required>
                      <option value="">Select dataset</option>
                      {datasets.map((d) => (
                        <option key={d.dataset_file} value={d.dataset_file}>{d.dataset_file} ({Math.round(d.size_bytes / 1024)} KB)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowRecalibrateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action" disabled={loading}>Run Recalibration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameCandidate && variant === 'use' && (
        <div className="modal-backdrop" onClick={() => { setRenameCandidate(null); setRenameValue('') }}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Rename Model</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setRenameCandidate(null); setRenameValue('') }}
                aria-label="Close"
              >
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Model Name</label>
                  <input
                    className="modal-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="Enter a clear model name"
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => { setRenameCandidate(null); setRenameValue('') }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => void handleRenameModel()}
                  disabled={loading || !renameValue.trim()}
                >
                  Save Name
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toggleCandidate && (variant === 'use' || variant === 'testing' || variant === 'load') && (
        <div className="modal-backdrop" onClick={() => setToggleCandidate(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {variant === 'testing' || variant === 'load'
                  ? 'Approve Model'
                  : toggleCandidate.status === 'ACTIVE'
                    ? 'Turn Off Model'
                    : 'Turn On Model'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setToggleCandidate(null)}
                aria-label="Close"
              >
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <p className="modal-delete-message">
                  {variant === 'testing' || variant === 'load'
                    ? `Approve ${toggleCandidate.name} v${toggleCandidate.version}? This will move it into Select Models as the active production model.`
                    : toggleCandidate.status === 'ACTIVE'
                    ? `Turn off ${toggleCandidate.name} v${toggleCandidate.version}? This will archive the current active model.`
                    : `Turn on ${toggleCandidate.name} v${toggleCandidate.version}? This will make it the active model for transaction risk scoring.`}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setToggleCandidate(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={variant === 'testing' || variant === 'load' || toggleCandidate.status !== 'ACTIVE' ? 'btn-primary-action' : 'btn-secondary-action'}
                  onClick={async () => {
                    const model = toggleCandidate
                    setToggleCandidate(null)
                    if (variant === 'testing' || variant === 'load') {
                      await handleDeploy(model.id)
                      showToast(`${model.name} v${model.version} approved and sent to Select Models.`)
                    } else {
                      await handleToggleModel(model)
                    }
                  }}
                  disabled={loading}
                >
                  {variant === 'testing' || variant === 'load' ? 'Approve' : toggleCandidate.status === 'ACTIVE' ? 'Turn Off' : 'Turn On'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (variant === 'calibration' || variant === 'use') && (
        <div className="modal-backdrop" onClick={() => setDeleteCandidate(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Model</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteCandidate(null)}
                aria-label="Close"
              >
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <p className="modal-delete-message">
                  Delete {deleteCandidate.name} v{deleteCandidate.version}? This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setDeleteCandidate(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger-action"
                  onClick={async () => {
                    const model = deleteCandidate
                    setDeleteCandidate(null)
                    await handleDeleteModel(model)
                  }}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
