import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const Configurations = () => {
    const [activeTab, setActiveTab] = useState('api')
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingConfig, setEditingConfig] = useState(null)
    
    const [newConfig, setNewConfig] = useState({
        name: '',
        type: 'api', // api, watchlist, blacklist, interpol, database
        base_url: '',
        host: '',
        port: '',
        database: '',
        username: '',
        password: '',
        timeout: 30000,
        retry_attempts: 3,
        description: ''
    })

    // Mock data - in production, this would come from backend
    const [configurations, setConfigurations] = useState([
        {
            id: 1,
            name: 'Main API',
            type: 'api',
            base_url: base_url,
            timeout: 30000,
            retry_attempts: 3,
            description: 'Primary API endpoint'
        },
        {
            id: 2,
            name: 'Watchlist Database',
            type: 'watchlist',
            host: 'localhost',
            port: '5432',
            database: 'watchlist_db',
            username: 'watchlist_user',
            password: '••••••••',
            description: 'Watchlist screening database'
        },
        {
            id: 3,
            name: 'Blacklist Database',
            type: 'blacklist',
            host: 'localhost',
            port: '5432',
            database: 'blacklist_db',
            username: 'blacklist_user',
            password: '••••••••',
            description: 'Blacklist screening database'
        },
        {
            id: 4,
            name: 'Interpol Database',
            type: 'interpol',
            host: 'interpol.example.com',
            port: '5432',
            database: 'interpol_db',
            username: 'interpol_user',
            password: '••••••••',
            description: 'Interpol database connection'
        }
    ])

    const queryClient = useQueryClient()

    // Mutation for saving configuration
    const saveConfigMutation = useMutation({
        mutationFn: (config) => {
            // In a real implementation, this would save to backend
            return Promise.resolve({ message: 'Configuration saved successfully', config })
        },
        onSuccess: (data) => {
            if (editingConfig) {
                // Update existing
                setConfigurations(configurations.map(c => 
                    c.id === editingConfig.id ? { ...data.config, id: editingConfig.id } : c
                ))
                setEditingConfig(null)
            } else {
                // Add new
                setConfigurations([...configurations, { ...data.config, id: Date.now() }])
            }
            setShowAddModal(false)
            resetForm()
            queryClient.invalidateQueries(['configurations'])
        },
    })

    // Mutation for deleting configuration
    const deleteConfigMutation = useMutation({
        mutationFn: (id) => {
            // In a real implementation, this would delete from backend
            return Promise.resolve({ message: 'Configuration deleted successfully' })
        },
        onSuccess: (_, id) => {
            setConfigurations(configurations.filter(c => c.id !== id))
            queryClient.invalidateQueries(['configurations'])
        },
    })

    const resetForm = () => {
        setNewConfig({
            name: '',
            type: 'api',
            base_url: '',
            host: '',
            port: '',
            database: '',
            username: '',
            password: '',
            timeout: 30000,
            retry_attempts: 3,
            description: ''
        })
    }

    const handleAddNew = () => {
        resetForm()
        setEditingConfig(null)
        setShowAddModal(true)
    }

    const handleEdit = (config) => {
        setNewConfig({ ...config })
        setEditingConfig(config)
        setShowAddModal(true)
    }

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this configuration?')) {
            deleteConfigMutation.mutate(id)
        }
    }

    const handleSave = () => {
        saveConfigMutation.mutate(newConfig)
    }

    const getTypeLabel = (type) => {
        const labels = {
            api: 'API',
            watchlist: 'Watchlist Database',
            blacklist: 'Blacklist Database',
            interpol: 'Interpol Database',
            database: 'Database'
        }
        return labels[type] || type
    }

    const getTypeIcon = (type) => {
        switch (type) {
            case 'api':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                )
            case 'watchlist':
            case 'blacklist':
            case 'interpol':
            case 'database':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                    </svg>
                )
            default:
                return null
        }
    }

    const filteredConfigurations = configurations.filter(config => {
        if (activeTab === 'api') return config.type === 'api'
        if (activeTab === 'database') return ['watchlist', 'blacklist', 'interpol', 'database'].includes(config.type)
        return true
    })

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Configurations</h4>
                    <small className="text-gray-500 text-xs">API, Database, and Data settings</small>
                </div>
                <button
                    onClick={handleAddNew}
                    className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                    </svg>
                    <span>Add Configuration</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 mb-4" style={{
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'api'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        API Configurations
                    </button>
                    <button
                        onClick={() => setActiveTab('database')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'database'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Database Configurations
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {filteredConfigurations.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            <p className="text-gray-500 text-sm">No configurations found. Click "Add Configuration" to create one.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredConfigurations.map((config) => {
                                const getAccentColor = (type) => {
                                    switch (type) {
                                        case 'api':
                                            return 'bg-blue-50/30'
                                        case 'watchlist':
                                            return 'bg-green-50/30'
                                        case 'blacklist':
                                            return 'bg-red-50/30'
                                        case 'interpol':
                                            return 'bg-purple-50/30'
                                        case 'database':
                                            return 'bg-orange-50/30'
                                        default:
                                            return 'bg-gray-50/30'
                                    }
                                }
                                return (
                                <div key={config.id} className={`border border-gray-200 ${getAccentColor(config.type)} rounded-lg p-4 hover:border-gray-300 transition-colors`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3 flex-1">
                                            <div className={`mt-1 ${
                                                config.type === 'api' ? 'text-blue-600' :
                                                config.type === 'watchlist' ? 'text-green-600' :
                                                config.type === 'blacklist' ? 'text-red-600' :
                                                config.type === 'interpol' ? 'text-purple-600' :
                                                'text-orange-600'
                                            }`}>
                                                {getTypeIcon(config.type)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h5 className="text-sm font-semibold text-gray-900">{config.name}</h5>
                                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                                        config.type === 'api' ? 'bg-blue-100 text-blue-700' :
                                                        config.type === 'watchlist' ? 'bg-green-100 text-green-700' :
                                                        config.type === 'blacklist' ? 'bg-red-100 text-red-700' :
                                                        config.type === 'interpol' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {getTypeLabel(config.type)}
                                                    </span>
                                                </div>
                                                {config.description && (
                                                    <p className="text-xs text-gray-500 mb-2">{config.description}</p>
                                                )}
                                                <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                                                    {config.type === 'api' ? (
                                                        <>
                                                            <div>
                                                                <span className="font-medium">Base URL:</span> {config.base_url}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Timeout:</span> {config.timeout}ms
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Retry Attempts:</span> {config.retry_attempts}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div>
                                                                <span className="font-medium">Host:</span> {config.host}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Port:</span> {config.port}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Database:</span> {config.database}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Username:</span> {config.username}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <button
                                                onClick={() => handleEdit(config)}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(config.id)}
                                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Configuration Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[85vh] m-4 flex flex-col">
                        {/* Header */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingConfig ? 'Edit Configuration' : 'Add Configuration'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAddModal(false)
                                    setEditingConfig(null)
                                    resetForm()
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Configuration Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newConfig.name}
                                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Main API, Watchlist Database"
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={newConfig.type}
                                    onChange={(e) => setNewConfig({ ...newConfig, type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="api">API</option>
                                    <option value="watchlist">Watchlist Database</option>
                                    <option value="blacklist">Blacklist Database</option>
                                    <option value="interpol">Interpol Database</option>
                                    <option value="database">Generic Database</option>
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={newConfig.description}
                                    onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Brief description of this configuration"
                                />
                            </div>

                            {/* API Configuration Fields */}
                            {newConfig.type === 'api' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Base URL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newConfig.base_url}
                                            onChange={(e) => setNewConfig({ ...newConfig, base_url: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="http://localhost:8000/api"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Timeout (ms) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={newConfig.timeout}
                                                onChange={(e) => setNewConfig({ ...newConfig, timeout: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="30000"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Retry Attempts <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={newConfig.retry_attempts}
                                                onChange={(e) => setNewConfig({ ...newConfig, retry_attempts: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="3"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Database Configuration Fields */}
                            {['watchlist', 'blacklist', 'interpol', 'database'].includes(newConfig.type) && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Host <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={newConfig.host}
                                                onChange={(e) => setNewConfig({ ...newConfig, host: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="localhost"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Port <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={newConfig.port}
                                                onChange={(e) => setNewConfig({ ...newConfig, port: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="5432"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Database Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newConfig.database}
                                            onChange={(e) => setNewConfig({ ...newConfig, database: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="database_name"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Username <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={newConfig.username}
                                                onChange={(e) => setNewConfig({ ...newConfig, username: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="db_user"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Password <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                value={newConfig.password}
                                                onChange={(e) => setNewConfig({ ...newConfig, password: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddModal(false)
                                    setEditingConfig(null)
                                    resetForm()
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saveConfigMutation.isLoading || !newConfig.name || !newConfig.type}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saveConfigMutation.isLoading ? 'Saving...' : editingConfig ? 'Update Configuration' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Configurations
