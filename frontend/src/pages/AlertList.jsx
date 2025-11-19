import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const AlertList = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [severityFilter, setSeverityFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [selectedAlert, setSelectedAlert] = useState(null)
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false)
    const [resolveNotes, setResolveNotes] = useState('')

    const queryClient = useQueryClient()

    // Mutation for resolving alert
    const resolveAlertMutation = useMutation({
        mutationFn: ({ alertId, notes }) => {
            return axios.post(`${base_url}/alerts/${alertId}/resolve/`, {
                resolution_notes: notes
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['alerts'])
            queryClient.invalidateQueries(['unread-alerts-count'])
            setIsResolveModalOpen(false)
            setResolveNotes('')
            setSelectedAlert(null)
        },
    })

    // Mutation for creating investigation (case)
    const createCaseMutation = useMutation({
        mutationFn: ({ alertId, notes }) => {
            // First, get the alert to get its risk_score
            return axios.get(`${base_url}/alerts/${alertId}/`).then(alertResponse => {
                const alert = alertResponse.data
                // Create investigation
                return axios.post(`${base_url}/investigations/`, {
                    alert: alertId,
                    findings: notes || `Investigation created for alert ${alert.alert_id}`,
                    initial_risk_score: alert.risk_score || 0.5,
                    is_suspicious: alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                }).then(() => {
                    // Update alert status to IN_PROGRESS (removes from NEW count)
                    return axios.patch(`${base_url}/alerts/${alertId}/`, {
                        status: 'IN_PROGRESS'
                    })
                })
            })
        },
        onSuccess: () => {
            // Invalidate all related queries to update counts
            queryClient.invalidateQueries(['alerts'])
            queryClient.invalidateQueries(['unread-alerts-count'])
            queryClient.invalidateQueries(['cases'])
            setIsResolveModalOpen(false)
            setResolveNotes('')
            setSelectedAlert(null)
        },
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['alerts', searchQuery, severityFilter, statusFilter],
        queryFn: async () => {
            let params = {
                page_size: 10000  // Fetch all alerts
            }
            if (searchQuery) params.search = searchQuery
            if (severityFilter) params.severity = severityFilter.toUpperCase()
            if (statusFilter) params.status = statusFilter.toUpperCase()
            
            // Fetch all pages
            let allAlerts = []
            let url = `${base_url}/alerts/`
            let hasMore = true
            
            while (hasMore) {
                const response = await axios.get(url, { params })
                const responseData = response.data
                
                if (responseData.results) {
                    allAlerts = allAlerts.concat(responseData.results)
                } else if (Array.isArray(responseData)) {
                    allAlerts = allAlerts.concat(responseData)
                    hasMore = false
                    break
                }
                
                if (responseData.next) {
                    url = responseData.next
                    params = {}  // Clear params for subsequent requests
                } else {
                    hasMore = false
                }
            }
            
            // Count only NEW (unread) alerts
            const newAlertsCount = allAlerts.filter(alert => alert.status === 'NEW').length
            
            return {
                results: allAlerts,
                count: allAlerts.length,
                newCount: newAlertsCount  // Count of unread alerts
            }
        },
    })

    const alerts = data?.results || []

    const getSeverityBadgeClass = (severity) => {
        switch (severity) {
            case 'CRITICAL':
                return 'bg-red-100 text-red-700'
            case 'HIGH':
                return 'bg-orange-100 text-orange-700'
            case 'MEDIUM':
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-blue-100 text-blue-700'
        }
    }

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'NEW':
                return 'bg-yellow-100 text-yellow-700'
            case 'IN_PROGRESS':
                return 'bg-blue-100 text-blue-700'
            case 'RESOLVED':
                return 'bg-green-100 text-green-700'
            case 'ESCALATED':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Alert Management</h4>
                    <small className="text-gray-500 text-xs">Monitor and manage AML alerts</small>
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
                                placeholder="Search alerts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Severity Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Severity:</label>
                            <select
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Severities</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
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
                                <option value="new">New</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="escalated">Escalated</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading alerts</div>
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
                                        ALERT ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        TRANSACTION
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        CUSTOMER
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        SEVERITY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        RISK SCORE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        DATE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const alert = alerts[index];
                                    return (
                                        <tr key={alert?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${alert ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert?.alert_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert?.alert_type || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert?.transaction_ids && alert.transaction_ids.length > 0 
                                                    ? alert.transaction_ids[0] 
                                                    : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert?.customer_name || alert?.customer_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getSeverityBadgeClass(alert.severity)}`}>
                                                        {alert.severity}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(alert.status)}`}>
                                                        {alert.status?.replace('_', ' ')}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert?.risk_score ? alert.risk_score.toFixed(2) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-500 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {alert?.triggered_at ? new Date(alert.triggered_at).toLocaleDateString() : '\u00A0'}
                                            </td>
                                            <td className="px-1 md:px-2 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {alert ? (
                                                    <div className="flex items-center space-x-1">
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAlert(alert)
                                                                setIsViewModalOpen(true)
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            View
                                                        </button>
                                                        <span className="text-gray-300">|</span>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAlert(alert)
                                                                setIsResolveModalOpen(true)
                                                            }}
                                                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                                                        >
                                                            Resolve
                                                        </button>
                                                    </div>
                                                ) : '\u00A0'}
                                            </td>
                                        </tr>
                                    );
                                })}
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
                    {data?.newCount !== undefined 
                        ? `${data.newCount} unread alert${data.newCount !== 1 ? 's' : ''} (${data.count || alerts.length} total)`
                        : alerts.length > 0 
                            ? `${alerts.filter(a => a.status === 'NEW').length} unread alert${alerts.filter(a => a.status === 'NEW').length !== 1 ? 's' : ''} (${alerts.length} total)`
                            : 'No alerts found'}
                </div>
            </div>

            {/* View Alert Modal */}
            {isViewModalOpen && selectedAlert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">View Alert</h3>
                            <button
                                onClick={() => {
                                    setIsViewModalOpen(false)
                                    setSelectedAlert(null)
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
                            {/* Alert Information Section */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Alert Information</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="font-medium text-gray-600">Alert ID:</span>
                                        <p className="text-gray-900 font-mono">{selectedAlert.alert_id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Alert Type:</span>
                                        <p className="text-gray-900">{selectedAlert.alert_type || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Severity:</span>
                                        <p>
                                            <span className={`px-2 py-1 rounded-full text-xs ${getSeverityBadgeClass(selectedAlert.severity)}`}>
                                                {selectedAlert.severity || 'N/A'}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Status:</span>
                                        <p>
                                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(selectedAlert.status)}`}>
                                                {selectedAlert.status?.replace('_', ' ') || 'N/A'}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Priority:</span>
                                        <p className="text-gray-900">
                                            {selectedAlert.priority ? `${selectedAlert.priority} (${selectedAlert.priority === 1 ? 'Highest' : selectedAlert.priority === 5 ? 'Lowest' : 'Medium'})` : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Assigned To:</span>
                                        <p className="text-gray-900">{selectedAlert.assigned_to_username || 'Unassigned'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-gray-600">Title:</span>
                                        <p className="text-gray-900">{selectedAlert.title || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-gray-600">Description:</span>
                                        <p className="text-gray-900">{selectedAlert.description || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Customer Information Section */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="font-medium text-gray-600">Customer ID:</span>
                                        <p className="text-gray-900 font-mono">{selectedAlert.customer_id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Customer Name:</span>
                                        <p className="text-gray-900">{selectedAlert.customer_name || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Transaction Information Section */}
                            {selectedAlert.transaction_ids && selectedAlert.transaction_ids.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Transaction Information</h4>
                                    <div className="text-xs">
                                        <span className="font-medium text-gray-600">Related Transactions:</span>
                                        <p className="text-gray-900 font-mono mt-1">{selectedAlert.transaction_ids.join(', ')}</p>
                                    </div>
                                </div>
                            )}

                            {/* Risk Assessment Section */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Risk Assessment</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="font-medium text-gray-600">Risk Score:</span>
                                        <p className="text-gray-900">{selectedAlert.risk_score ? selectedAlert.risk_score.toFixed(2) : '0.00'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">ML Confidence:</span>
                                        <p className="text-gray-900">{selectedAlert.ml_confidence ? `${(selectedAlert.ml_confidence * 100).toFixed(1)}%` : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Timestamps Section */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Timestamps</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="font-medium text-gray-600">Triggered At:</span>
                                        <p className="text-gray-900">{selectedAlert.triggered_at ? new Date(selectedAlert.triggered_at).toLocaleString() : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Last Updated:</span>
                                        <p className="text-gray-900">{selectedAlert.updated_at ? new Date(selectedAlert.updated_at).toLocaleString() : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            {(selectedAlert.investigation_notes || selectedAlert.resolution_notes) && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Notes</h4>
                                    <div className="space-y-3 text-xs">
                                        {selectedAlert.investigation_notes && (
                                            <div>
                                                <span className="font-medium text-gray-600">Investigation Notes:</span>
                                                <p className="text-gray-900 mt-1">{selectedAlert.investigation_notes}</p>
                                            </div>
                                        )}
                                        {selectedAlert.resolution_notes && (
                                            <div>
                                                <span className="font-medium text-gray-600">Resolution Notes:</span>
                                                <p className="text-gray-900 mt-1">{selectedAlert.resolution_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SLA Information Section */}
                            {selectedAlert.sla_deadline && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">SLA Information</h4>
                                    <div className="text-xs">
                                        <span className="font-medium text-gray-600">SLA Deadline:</span>
                                        <p className={`mt-1 ${selectedAlert.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                                            {new Date(selectedAlert.sla_deadline).toLocaleString()}
                                            {selectedAlert.is_overdue && ' (Overdue)'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-3 py-2 flex justify-end space-x-3 flex-shrink-0" style={{
                            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsViewModalOpen(false)
                                    setSelectedAlert(null)
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolve Alert Modal */}
            {isResolveModalOpen && selectedAlert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Resolve Alert</h3>
                            <button
                                onClick={() => {
                                    setIsResolveModalOpen(false)
                                    setResolveNotes('')
                                    setSelectedAlert(null)
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
                            {/* Alert Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <div className="text-sm font-semibold text-gray-900 mb-2">Alert Details</div>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <div><span className="font-medium">Alert ID:</span> {selectedAlert.alert_id}</div>
                                    <div><span className="font-medium">Type:</span> {selectedAlert.alert_type}</div>
                                    <div><span className="font-medium">Severity:</span> {selectedAlert.severity}</div>
                                    <div><span className="font-medium">Customer:</span> {selectedAlert.customer_name || selectedAlert.customer_id}</div>
                                </div>
                            </div>

                            {/* Notes Textarea */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notes <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={resolveNotes}
                                    onChange={(e) => setResolveNotes(e.target.value)}
                                    placeholder="Enter resolution notes or investigation findings..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    rows="5"
                                />
                            </div>

                            {/* Error Messages */}
                            {(resolveAlertMutation.isError || createCaseMutation.isError) && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                    <div className="text-sm text-red-800">
                                        {resolveAlertMutation.error?.response?.data?.message || 
                                         createCaseMutation.error?.response?.data?.message || 
                                         'An error occurred. Please try again.'}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsResolveModalOpen(false)
                                    setResolveNotes('')
                                    setSelectedAlert(null)
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                disabled={resolveAlertMutation.isLoading || createCaseMutation.isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    createCaseMutation.mutate({
                                        alertId: selectedAlert.id,
                                        notes: resolveNotes
                                    })
                                }}
                                disabled={resolveAlertMutation.isLoading || createCaseMutation.isLoading}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createCaseMutation.isLoading ? 'Creating Case...' : 'Move to Case Management'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    resolveAlertMutation.mutate({
                                        alertId: selectedAlert.id,
                                        notes: resolveNotes
                                    })
                                }}
                                disabled={resolveAlertMutation.isLoading || createCaseMutation.isLoading}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resolveAlertMutation.isLoading ? 'Resolving...' : 'Resolve Alert'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AlertList

