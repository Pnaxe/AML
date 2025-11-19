import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const Cases = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false)
    const [isSARModalOpen, setIsSARModalOpen] = useState(false)
    const [selectedCase, setSelectedCase] = useState(null)
    const [resolveNotes, setResolveNotes] = useState('')
    const [sarNotes, setSarNotes] = useState('')
    
    const queryClient = useQueryClient()

    // Fetch investigations (cases created from alerts)
    const { data, isLoading, error } = useQuery({
        queryKey: ['cases', searchQuery, statusFilter, priorityFilter],
        queryFn: async () => {
            let params = {
                page_size: 10000  // Fetch all investigations
            }
            
            // Fetch all pages
            let allInvestigations = []
            let url = `${base_url}/investigations/`
            let hasMore = true
            
            while (hasMore) {
                const response = await axios.get(url, { params })
                const responseData = response.data
                
                if (responseData.results) {
                    allInvestigations = allInvestigations.concat(responseData.results)
                } else if (Array.isArray(responseData)) {
                    allInvestigations = allInvestigations.concat(responseData)
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
            
            // Fetch alert details for each investigation to use as evidence
            // Evidence is the alert information that caused the case to be created
            const investigationsWithEvidence = await Promise.all(
                allInvestigations.map(async (inv) => {
                    try {
                        // Get the alert ID from the investigation
                        const alertId = inv.alert || (typeof inv.alert === 'object' ? inv.alert.id : null)
                        
                        if (alertId) {
                            // Fetch the full alert details
                            const alertResponse = await axios.get(`${base_url}/alerts/${alertId}/`)
                            const alert = alertResponse.data
                            
                            // Create evidence items from alert data
                            const evidence = []
                            
                            // Alert type and description as primary evidence
                            if (alert.alert_type) {
                                evidence.push({
                                    type: 'alert_type',
                                    label: 'Alert Type',
                                    value: alert.alert_type,
                                    description: alert.description || alert.alert_type
                                })
                            }
                            
                            // Transaction information
                            if (alert.transaction_ids && alert.transaction_ids.length > 0) {
                                evidence.push({
                                    type: 'transactions',
                                    label: 'Transactions',
                                    value: `${alert.transaction_ids.length} transaction(s)`,
                                    description: `Transaction IDs: ${alert.transaction_ids.slice(0, 3).join(', ')}${alert.transaction_ids.length > 3 ? '...' : ''}`
                                })
                            }
                            
                            // Amount information if available
                            if (alert.amount || alert.transaction_amount) {
                                const amount = alert.amount || alert.transaction_amount
                                evidence.push({
                                    type: 'amount',
                                    label: 'Amount',
                                    value: typeof amount === 'number' ? `$${amount.toLocaleString()}` : amount,
                                    description: `Large transaction amount detected`
                                })
                            }
                            
                            // Customer information
                            if (alert.customer_name || alert.customer_id) {
                                evidence.push({
                                    type: 'customer',
                                    label: 'Customer',
                                    value: alert.customer_name || alert.customer_id,
                                    description: `Customer involved: ${alert.customer_name || alert.customer_id}`
                                })
                            }
                            
                            // Risk score
                            if (alert.risk_score) {
                                evidence.push({
                                    type: 'risk',
                                    label: 'Risk Score',
                                    value: alert.risk_score.toFixed(2),
                                    description: `Risk score: ${alert.risk_score.toFixed(2)}`
                                })
                            }
                            
                            // Severity
                            if (alert.severity) {
                                evidence.push({
                                    type: 'severity',
                                    label: 'Severity',
                                    value: alert.severity,
                                    description: `Alert severity: ${alert.severity}`
                                })
                            }
                            
                            return {
                                ...inv,
                                evidence: evidence,
                                alert_details: alert
                            }
                        }
                    } catch (error) {
                        // If alert fetch fails, continue without evidence
                        console.log(`Failed to fetch alert for investigation ${inv.id}:`, error)
                    }
                    
                    return {
                        ...inv,
                        evidence: [],
                        alert_details: null
                    }
                })
            )
            
            allInvestigations = investigationsWithEvidence
            
            // Apply client-side filters
            let filtered = allInvestigations
            
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                filtered = filtered.filter(inv => 
                    inv.alert_id?.toLowerCase().includes(query) ||
                    inv.alert_title?.toLowerCase().includes(query) ||
                    inv.investigator_username?.toLowerCase().includes(query)
                )
            }
            
            if (statusFilter) {
                // Map status filter to investigation completion status
                if (statusFilter === 'completed') {
                    filtered = filtered.filter(inv => inv.completed_at !== null)
                } else if (statusFilter === 'in_progress') {
                    filtered = filtered.filter(inv => inv.completed_at === null)
                }
            }
            
            return {
                results: filtered,
                count: filtered.length
            }
        },
    })

    const cases = data?.results || []

    // Mutation for resolving a case
    const resolveCaseMutation = useMutation({
        mutationFn: ({ caseId, notes }) => {
            return axios.post(`${base_url}/investigations/${caseId}/complete/`, {
                resolution_notes: notes
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['cases'])
            setIsResolveModalOpen(false)
            setResolveNotes('')
            setSelectedCase(null)
        },
    })

    // Mutation for proceeding to SAR filing
    const proceedToSARMutation = useMutation({
        mutationFn: ({ caseId, notes }) => {
            // Mark the investigation as requiring SAR
            return axios.patch(`${base_url}/investigations/${caseId}/`, {
                sar_required: true,
                recommendation: notes || 'Case requires SAR filing'
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['cases'])
            setIsSARModalOpen(false)
            setSarNotes('')
            setSelectedCase(null)
        },
    })

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'COMPLETED':
            case 'CLOSED':
                return 'bg-green-100 text-green-700'
            case 'IN_PROGRESS':
            case 'UNDER_REVIEW':
                return 'bg-blue-100 text-blue-700'
            case 'PENDING':
            case 'NEW':
                return 'bg-yellow-100 text-yellow-700'
            case 'ESCALATED':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const getPriorityBadgeClass = (priority) => {
        switch (priority) {
            case 'CRITICAL':
                return 'bg-red-100 text-red-700'
            case 'HIGH':
                return 'bg-orange-100 text-orange-700'
            case 'MEDIUM':
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Case Management</h4>
                    <small className="text-gray-500 text-xs">Investigation cases and workflow</small>
                </div>
                <div>
                    <button className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                        </svg>
                        <span>New Case</span>
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
                                placeholder="Search cases..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Status</option>
                                <option value="new">New</option>
                                <option value="in_progress">In Progress</option>
                                <option value="under_review">Under Review</option>
                                <option value="completed">Completed</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>

                        {/* Priority Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Priority:</label>
                            <select
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[120px]"
                            >
                                <option value="">All Priorities</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* Cases Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading cases</div>
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
                                        CASE ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        ALERT ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        ALERT / CUSTOMER
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        PRIORITY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        INVESTIGATOR
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        EVIDENCE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const caseItem = cases[index];
                                    // Use actual investigation data
                                    const caseData = caseItem ? {
                                        case_id: `CASE-${caseItem.id || index}`,
                                        alert_id: caseItem.alert_id || 'N/A',
                                        alert_title: caseItem.alert_title || 'N/A',
                                        status: caseItem.completed_at ? 'COMPLETED' : 'IN_PROGRESS',
                                        priority: caseItem.is_suspicious ? 'HIGH' : 'MEDIUM',
                                        investigator: caseItem.investigator_username || 'Unassigned',
                                        started_at: caseItem.started_at,
                                        sar_required: caseItem.sar_required || false,
                                        sar_filed: caseItem.sar_filed || false
                                    } : null;
                                    
                                    return (
                                        <tr key={caseItem?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${caseData ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData?.case_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData?.alert_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData ? (
                                                    <div>
                                                        <div className="font-medium">{caseData.alert_title || 'N/A'}</div>
                                                        <div className="text-gray-500 text-xs">{caseData.customer_name || 'N/A'}</div>
                                                    </div>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(caseData.status)}`}>
                                                        {caseData.status?.replace('_', ' ')}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getPriorityBadgeClass(caseData.priority)}`}>
                                                        {caseData.priority}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData?.investigator || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {caseData ? (
                                                    caseItem?.evidence && caseItem.evidence.length > 0 ? (
                                                        <div className="flex flex-col space-y-1">
                                                            <span className="text-blue-600 font-medium text-xs">
                                                                {caseItem.evidence.length} {caseItem.evidence.length === 1 ? 'evidence item' : 'evidence items'}
                                                            </span>
                                                            <div className="flex flex-col gap-1">
                                                                {caseItem.evidence.slice(0, 2).map((ev, idx) => (
                                                                    <div key={idx} className="text-xs">
                                                                        <span className="font-medium text-gray-700">{ev.label}:</span>
                                                                        <span className="ml-1 text-gray-900">{ev.value}</span>
                                                                        {ev.description && ev.description !== ev.value && (
                                                                            <div className="text-gray-500 text-xs mt-0.5 truncate" title={ev.description}>
                                                                                {ev.description.length > 50 ? ev.description.substring(0, 50) + '...' : ev.description}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {caseItem.evidence.length > 2 && (
                                                                    <span className="text-xs text-gray-500 mt-1">
                                                                        +{caseItem.evidence.length - 2} more evidence items
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">No evidence</span>
                                                    )
                                                ) : (
                                                    '\u00A0'
                                                )}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {caseData ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedCase(caseItem)
                                                                setIsResolveModalOpen(true)
                                                            }}
                                                            disabled={caseData.status === 'COMPLETED' || resolveCaseMutation.isLoading}
                                                            className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Resolve
                                                        </button>
                                                        <button className="text-gray-400">|</button>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedCase(caseItem)
                                                                setIsSARModalOpen(true)
                                                            }}
                                                            disabled={caseItem?.sar_filed || proceedToSARMutation.isLoading}
                                                            className="text-orange-600 hover:text-orange-800 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {caseItem?.sar_filed ? 'SAR Filed' : 'Proceed to SAR'}
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
                    {data?.count ? `Showing ${data.count} cases` : 'All cases displayed'}
                </div>
            </div>

            {/* Resolve Case Modal */}
            {isResolveModalOpen && selectedCase && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Resolve Case</h3>
                            <button
                                onClick={() => {
                                    setIsResolveModalOpen(false)
                                    setSelectedCase(null)
                                    setResolveNotes('')
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
                            {/* Case Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <div className="text-sm font-semibold text-gray-900 mb-2">Case Details</div>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <div><span className="font-medium">Case ID:</span> CASE-{selectedCase.id}</div>
                                    <div><span className="font-medium">Alert ID:</span> {selectedCase.alert_id || 'N/A'}</div>
                                    <div><span className="font-medium">Alert Title:</span> {selectedCase.alert_title || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Resolution Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Resolution Notes <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={resolveNotes}
                                    onChange={(e) => setResolveNotes(e.target.value)}
                                    placeholder="Enter resolution notes or findings..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    rows="5"
                                />
                            </div>

                            {/* Error Message */}
                            {resolveCaseMutation.isError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                    {resolveCaseMutation.error?.response?.data?.detail ||
                                        resolveCaseMutation.error?.response?.data?.message ||
                                        resolveCaseMutation.error?.message ||
                                        'Failed to resolve case. Please try again.'}
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsResolveModalOpen(false)
                                    setSelectedCase(null)
                                    setResolveNotes('')
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    resolveCaseMutation.mutate({
                                        caseId: selectedCase.id,
                                        notes: resolveNotes
                                    })
                                }}
                                disabled={resolveCaseMutation.isLoading}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resolveCaseMutation.isLoading ? 'Resolving...' : 'Resolve Case'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Proceed to SAR Filing Modal */}
            {isSARModalOpen && selectedCase && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Proceed to SAR Filing</h3>
                            <button
                                onClick={() => {
                                    setIsSARModalOpen(false)
                                    setSelectedCase(null)
                                    setSarNotes('')
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
                            {/* Case Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <div className="text-sm font-semibold text-gray-900 mb-2">Case Details</div>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <div><span className="font-medium">Case ID:</span> CASE-{selectedCase.id}</div>
                                    <div><span className="font-medium">Alert ID:</span> {selectedCase.alert_id || 'N/A'}</div>
                                    <div><span className="font-medium">Alert Title:</span> {selectedCase.alert_title || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                                <p className="text-xs text-orange-800">
                                    <span className="font-semibold">Note:</span> This will mark the case as requiring SAR filing. You will need to complete the SAR filing process separately.
                                </p>
                            </div>

                            {/* SAR Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    SAR Filing Notes <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={sarNotes}
                                    onChange={(e) => setSarNotes(e.target.value)}
                                    placeholder="Enter notes for SAR filing (e.g., reason for SAR filing, suspicious activity details)..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    rows="5"
                                />
                            </div>

                            {/* Error Message */}
                            {proceedToSARMutation.isError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                    {proceedToSARMutation.error?.response?.data?.detail ||
                                        proceedToSARMutation.error?.response?.data?.message ||
                                        proceedToSARMutation.error?.message ||
                                        'Failed to proceed to SAR filing. Please try again.'}
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSARModalOpen(false)
                                    setSelectedCase(null)
                                    setSarNotes('')
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    proceedToSARMutation.mutate({
                                        caseId: selectedCase.id,
                                        notes: sarNotes
                                    })
                                }}
                                disabled={proceedToSARMutation.isLoading}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {proceedToSARMutation.isLoading ? 'Processing...' : 'Proceed to SAR Filing'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Cases
