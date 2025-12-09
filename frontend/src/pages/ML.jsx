import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const ML = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [isNewModelModalOpen, setIsNewModelModalOpen] = useState(false)
    const [uploadMode, setUploadMode] = useState('manual') // 'manual' or 'upload'
    const [modelForm, setModelForm] = useState({
        name: '',
        type: '',
        description: '',
        algorithm: '',
        training_data_source: '',
        version: '',
        parameters: '',
        model_file: null
    })
    const [modelFileName, setModelFileName] = useState('')
    const queryClient = useQueryClient()

    // Using alerts API as a placeholder for ML models
    // In production, this would be an ML models API
    const { data, isLoading, error } = useQuery({
        queryKey: ['ml-models', searchQuery, typeFilter, statusFilter],
        queryFn: () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            if (statusFilter) params.status = statusFilter.toUpperCase()
            return axios.get(`${base_url}/alerts/`, { params }).then(res => res.data)
        },
    })

    const models = data?.results || []

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'ACTIVE':
            case 'DEPLOYED':
                return 'bg-green-100 text-green-700'
            case 'TRAINING':
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-700'
            case 'INACTIVE':
            case 'ARCHIVED':
                return 'bg-gray-100 text-gray-700'
            default:
                return 'bg-blue-100 text-blue-700'
        }
    }

    const getTypeBadgeClass = (type) => {
        switch (type) {
            case 'RISK_SCORING':
                return 'bg-red-100 text-red-700'
            case 'ANOMALY_DETECTION':
                return 'bg-purple-100 text-purple-700'
            case 'PATTERN_RECOGNITION':
                return 'bg-blue-100 text-blue-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const resetModelForm = () => {
        setModelForm({
            name: '',
            type: '',
            description: '',
            algorithm: '',
            training_data_source: '',
            version: '',
            parameters: '',
            model_file: null
        })
        setModelFileName('')
        setUploadMode('manual')
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setModelForm({ ...modelForm, model_file: file })
            setModelFileName(file.name)
        }
    }

    const createModelMutation = useMutation({
        mutationFn: async (formData) => {
            // TODO: Replace with actual ML model API endpoint when available
            return Promise.resolve({ id: Date.now(), ...formData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ml-models'] })
            setIsNewModelModalOpen(false)
            resetModelForm()
        },
    })

    const handleCreateModel = () => {
        if (!modelForm.name) {
            return
        }
        // If upload mode, require model file; if manual mode, require type and algorithm
        if (uploadMode === 'upload' && !modelForm.model_file) {
            return
        }
        if (uploadMode === 'manual' && (!modelForm.type || !modelForm.algorithm)) {
            return
        }
        createModelMutation.mutate({ ...modelForm, upload_mode: uploadMode })
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">ML Models</h4>
                    <small className="text-gray-500 text-xs">Machine learning model management and monitoring</small>
                </div>
                <div>
                    <button
                        onClick={() => setIsNewModelModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                        </svg>
                        <span>New Model</span>
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-gray-50 border border-gray-200 p-4 -mx-2 flex-shrink-0 mb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        {/* Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search models..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Model Type Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Type:</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Types</option>
                                <option value="risk_scoring">Risk Scoring</option>
                                <option value="anomaly_detection">Anomaly Detection</option>
                                <option value="pattern_recognition">Pattern Recognition</option>
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[120px]"
                            >
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="training">Training</option>
                                <option value="inactive">Inactive</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* Models Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading models</div>
                            <div className="text-xs text-gray-600">
                                {error.response?.status === 401
                                    ? 'Authentication required. Please log in to the Django admin first.'
                                    : error.response?.status === 403
                                        ? 'Permission denied. You do not have access to this resource.'
                                        : error.response?.status
                                            ? `Error ${error.response.status}: ${error.response.statusText}`
                                            : error.message || 'Network error. Please check if the Django server is running.'}
                            </div>
                            {error.response?.status === 401 && (
                                <a
                                    href="http://localhost:8000/admin/login/"
                                    target="_blank"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline mt-2"
                                >
                                    Open Django Admin Login
                                </a>
                            )}
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-700 sticky top-0 z-10">
                                <tr className="border-b border-gray-200">
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        MODEL ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        MODEL NAME
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        ACCURACY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        LAST TRAINED
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {models.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-2 md:px-3 py-8 text-center text-gray-500 text-sm">
                                            No ML models found
                                        </td>
                                    </tr>
                                ) : (
                                    models.map((item, index) => (
                                        <tr key={item?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} hover:opacity-80`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? `ML-${String(item.id || index).padStart(6, '0')}` : ''}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item?.alert_type || `Model ${item?.id || index}` || ''}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getTypeBadgeClass('RISK_SCORING')}`}>
                                                        Risk Scoring
                                                    </span>
                                                ) : ''}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(item.status || 'ACTIVE')}`}>
                                                        {item.status || 'Active'}
                                                    </span>
                                                ) : ''}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? `${(85 + (item.id || index) % 15).toFixed(1)}%` : ''}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-500 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item?.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                                                            View
                                                        </button>
                                                        <button className="text-gray-400">|</button>
                                                        <button className="text-gray-600 hover:text-gray-800 text-xs font-medium">
                                                            Edit
                                                        </button>
                                                    </div>
                                                ) : ''}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Paginator */}
            <div className="bg-white p-4 border border-gray-200 flex items-center justify-start flex-shrink-0 mt-1 mb-1 w-full" style={{
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
                <div className="text-sm text-gray-700">
                    {data?.count ? `Showing ${data.count} models` : 'All models displayed'}
                </div>
            </div>

            {/* New Model Modal */}
            {isNewModelModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Sticky */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">New ML Model</h3>
                            <button
                                onClick={() => {
                                    setIsNewModelModalOpen(false)
                                    resetModelForm()
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                            {/* Upload Mode Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Creation Method <span className="text-red-500">*</span>
                                </label>
                                <div className="flex space-x-4">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="uploadMode"
                                            value="manual"
                                            checked={uploadMode === 'manual'}
                                            onChange={(e) => setUploadMode(e.target.value)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Manual Entry</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="uploadMode"
                                            value="upload"
                                            checked={uploadMode === 'upload'}
                                            onChange={(e) => setUploadMode(e.target.value)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Upload Model File</span>
                                    </label>
                                </div>
                            </div>

                            {/* Model Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Model Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={modelForm.name}
                                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter model name"
                                />
                            </div>

                            {/* Manual Entry Fields - shown only when uploadMode is 'manual' */}
                            {uploadMode === 'manual' && (
                                <>
                                    {/* Model Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Model Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={modelForm.type}
                                            onChange={(e) => setModelForm({ ...modelForm, type: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select model type</option>
                                            <option value="RISK_SCORING">Risk Scoring</option>
                                            <option value="ANOMALY_DETECTION">Anomaly Detection</option>
                                            <option value="PATTERN_RECOGNITION">Pattern Recognition</option>
                                        </select>
                                    </div>

                                    {/* Algorithm */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Algorithm <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={modelForm.algorithm}
                                            onChange={(e) => setModelForm({ ...modelForm, algorithm: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select algorithm</option>
                                            <option value="random_forest">Random Forest</option>
                                            <option value="neural_network">Neural Network</option>
                                            <option value="gradient_boosting">Gradient Boosting</option>
                                            <option value="svm">Support Vector Machine (SVM)</option>
                                            <option value="logistic_regression">Logistic Regression</option>
                                            <option value="decision_tree">Decision Tree</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* Model File Upload - shown only when uploadMode is 'upload' */}
                            {uploadMode === 'upload' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Upload Model File <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1 flex items-center">
                                        <label className="flex flex-col items-center justify-center w-full border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
                                                <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                                </svg>
                                                <p className="mb-2 text-xs text-gray-500">
                                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Model files (.pkl, .h5, .joblib, .pb, .onnx, etc.)
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Model metadata will be extracted from the file
                                                </p>
                                                {modelFileName && (
                                                    <p className="mt-2 text-xs text-blue-600 font-medium">
                                                        Selected: {modelFileName}
                                                    </p>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".pkl,.h5,.joblib,.pb,.onnx,.pt,.pth,.model,.sav"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Version */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Version <span className="text-gray-500">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={modelForm.version}
                                    onChange={(e) => setModelForm({ ...modelForm, version: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., 1.0.0"
                                />
                            </div>

                            {/* Training Data Source */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Training Data Source <span className="text-gray-500">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={modelForm.training_data_source}
                                    onChange={(e) => setModelForm({ ...modelForm, training_data_source: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter training data source or path"
                                />
                            </div>

                            {/* Parameters */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Model Parameters <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={modelForm.parameters}
                                    onChange={(e) => setModelForm({ ...modelForm, parameters: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                    placeholder="Enter model parameters (JSON format or key-value pairs)..."
                                    rows="4"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={modelForm.description}
                                    onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                    placeholder="Enter model description..."
                                    rows="4"
                                />
                            </div>

                            {/* Error Message */}
                            {createModelMutation.isError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                    {createModelMutation.error?.response?.data?.detail ||
                                        createModelMutation.error?.response?.data?.message ||
                                        createModelMutation.error?.message ||
                                        'Failed to create model. Please try again.'}
                                </div>
                            )}
                        </div>

                        {/* Footer - Sticky */}
                        <div className="bg-white border-t border-gray-200 shadow px-3 py-2 flex justify-end space-x-3 flex-shrink-0" style={{
                            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNewModelModalOpen(false)
                                    resetModelForm()
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateModel}
                                disabled={
                                    createModelMutation.isLoading || 
                                    !modelForm.name || 
                                    (uploadMode === 'manual' && (!modelForm.type || !modelForm.algorithm)) ||
                                    (uploadMode === 'upload' && !modelForm.model_file)
                                }
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createModelMutation.isLoading ? 'Creating...' : 'Create Model'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ML
