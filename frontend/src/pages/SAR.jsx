import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const SAR = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [isLawEnforcementModalOpen, setIsLawEnforcementModalOpen] = useState(false)
    const [selectedSAR, setSelectedSAR] = useState(null)
    const [lawEnforcementForm, setLawEnforcementForm] = useState({
        delivery_method: '',
        email: '',
        system_user: '',
        recipient_name: '',
        recipient_organization: '',
        notes: ''
    })
    const queryClient = useQueryClient()

    // For now, we'll use customers API as a placeholder
    // In production, this would be a SAR reports API
    const { data, isLoading, error } = useQuery({
        queryKey: ['sar', searchQuery, statusFilter, priorityFilter],
        queryFn: () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            return axios.get(`${base_url}/customers/`, { params }).then(res => res.data)
        },
    })

    const sarReports = data?.results || []

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'FILED':
            case 'ACKNOWLEDGED':
                return 'bg-green-100 text-green-700'
            case 'APPROVED':
            case 'PENDING_APPROVAL':
                return 'bg-blue-100 text-blue-700'
            case 'UNDER_REVIEW':
            case 'PENDING_REVIEW':
                return 'bg-yellow-100 text-yellow-700'
            case 'REJECTED':
            case 'CANCELLED':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const getPriorityBadgeClass = (priority) => {
        switch (priority) {
            case 'CRITICAL':
                return 'bg-red-100 text-red-700'
            case 'URGENT':
                return 'bg-orange-100 text-orange-700'
            case 'PRIORITY':
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const handleViewSAR = (sarData) => {
        setSelectedSAR(sarData)
        setIsViewModalOpen(true)
    }

    const handleSendToLawEnforcement = (sarData) => {
        setSelectedSAR(sarData)
        setIsLawEnforcementModalOpen(true)
    }

    const resetLawEnforcementForm = () => {
        setLawEnforcementForm({
            delivery_method: '',
            email: '',
            system_user: '',
            recipient_name: '',
            recipient_organization: '',
            notes: ''
        })
    }

    const sendToLawEnforcementMutation = useMutation({
        mutationFn: async (formData) => {
            // TODO: Replace with actual API endpoint when available
            return Promise.resolve({ success: true, ...formData })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sar'] })
            setIsLawEnforcementModalOpen(false)
            setSelectedSAR(null)
            resetLawEnforcementForm()
        },
    })

    const handleSubmitLawEnforcement = () => {
        if (!lawEnforcementForm.delivery_method) {
            return
        }
        if (lawEnforcementForm.delivery_method === 'email' && !lawEnforcementForm.email) {
            return
        }
        if (lawEnforcementForm.delivery_method === 'system' && !lawEnforcementForm.system_user) {
            return
        }
        sendToLawEnforcementMutation.mutate({
            sar_id: selectedSAR?.sar_number,
            ...lawEnforcementForm
        })
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">SAR</h4>
                    <small className="text-gray-500 text-xs">Suspicious Activity Reports received from banks</small>
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
                                placeholder="Search SAR reports..."
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
                                <option value="draft">Draft</option>
                                <option value="pending_review">Pending Review</option>
                                <option value="under_review">Under Review</option>
                                <option value="approved">Approved</option>
                                <option value="filed">Filed</option>
                                <option value="acknowledged">Acknowledged</option>
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
                                <option value="urgent">Urgent</option>
                                <option value="priority">Priority</option>
                                <option value="routine">Routine</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* SAR Reports Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading SAR reports</div>
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
                                        SAR NUMBER
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        SUBJECT
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        ACTIVITY TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        BANK
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        PRIORITY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        FILING DATE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const sar = sarReports[index];
                                    // Mock SAR data structure for display
                                    // In production, this would come from the SAR API with bank information
                                    const bankNames = ['First National Bank', 'Standard Chartered', 'CBZ Bank', 'Ecobank', 'Nedbank', 'Stanbic Bank', 'Barclays Bank', 'CABS'];
                                    const sarData = sar ? {
                                        sar_number: `SAR-${sar.id || index}`,
                                        subject: sar.customer_type === 'INDIVIDUAL' 
                                            ? `${sar.first_name || ''} ${sar.last_name || ''}`.trim() || 'N/A'
                                            : sar.company_name || 'N/A',
                                        activity_type: sar.is_sanctioned ? 'Sanctions Violation' : sar.is_pep ? 'Corruption' : 'Money Laundering',
                                        bank: bankNames[(sar.id || index) % bankNames.length], // Assign bank based on ID
                                        status: 'FILED',
                                        priority: sar.risk_level === 'HIGH' ? 'URGENT' : sar.risk_level === 'MEDIUM' ? 'PRIORITY' : 'ROUTINE',
                                        filing_date: sar.updated_at ? new Date(sar.updated_at).toLocaleDateString() : 'N/A'
                                    } : null;
                                    
                                    return (
                                        <tr key={sar?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${sarData ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData?.sar_number || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData?.subject || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData?.activity_type || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData?.bank || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(sarData.status)}`}>
                                                        {sarData.status}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getPriorityBadgeClass(sarData.priority)}`}>
                                                        {sarData.priority}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-500 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {sarData?.filing_date || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {sarData ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button 
                                                            onClick={() => handleViewSAR(sarData)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            View
                                                        </button>
                                                        <button className="text-gray-400">|</button>
                                                        <button 
                                                            onClick={() => handleSendToLawEnforcement(sarData)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            Send to Law Enforcement
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
                    {data?.count ? `Showing ${data.count} SAR reports` : 'All SAR reports displayed'}
                </div>
            </div>

            {/* View SAR Modal */}
            {isViewModalOpen && selectedSAR && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">SAR Details</h3>
                            <button
                                onClick={() => {
                                    setIsViewModalOpen(false)
                                    setSelectedSAR(null)
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
                            {/* SAR Information Section */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">SAR Information</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="font-medium text-gray-600">SAR Number:</span>
                                        <p className="text-gray-900 font-mono">{selectedSAR.sar_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Subject:</span>
                                        <p className="text-gray-900">{selectedSAR.subject || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Activity Type:</span>
                                        <p className="text-gray-900">{selectedSAR.activity_type || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Bank:</span>
                                        <p className="text-gray-900">{selectedSAR.bank || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Status:</span>
                                        <p>
                                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(selectedSAR.status)}`}>
                                                {selectedSAR.status || 'N/A'}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Priority:</span>
                                        <p>
                                            <span className={`px-2 py-1 rounded-full text-xs ${getPriorityBadgeClass(selectedSAR.priority)}`}>
                                                {selectedSAR.priority || 'N/A'}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Filing Date:</span>
                                        <p className="text-gray-900">{selectedSAR.filing_date || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-3 py-2 flex justify-end space-x-3 flex-shrink-0" style={{
                            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsViewModalOpen(false)
                                    setSelectedSAR(null)
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send to Law Enforcement Modal */}
            {isLawEnforcementModalOpen && selectedSAR && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Sticky */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Send to Law Enforcement</h3>
                            <button
                                onClick={() => {
                                    setIsLawEnforcementModalOpen(false)
                                    setSelectedSAR(null)
                                    resetLawEnforcementForm()
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
                            {/* SAR Information */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">SAR Details</h4>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <div><span className="font-medium">SAR Number:</span> {selectedSAR.sar_number}</div>
                                    <div><span className="font-medium">Subject:</span> {selectedSAR.subject}</div>
                                    <div><span className="font-medium">Activity Type:</span> {selectedSAR.activity_type}</div>
                                    <div><span className="font-medium">Bank:</span> {selectedSAR.bank || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Delivery Method */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Delivery Method <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={lawEnforcementForm.delivery_method}
                                    onChange={(e) => setLawEnforcementForm({ ...lawEnforcementForm, delivery_method: e.target.value, email: '', system_user: '' })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select delivery method</option>
                                    <option value="email">Email</option>
                                    <option value="system">System Integration</option>
                                </select>
                            </div>

                            {/* Email Field - shown when delivery method is email */}
                            {lawEnforcementForm.delivery_method === 'email' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={lawEnforcementForm.email}
                                        onChange={(e) => setLawEnforcementForm({ ...lawEnforcementForm, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="lawenforcement@example.com"
                                    />
                                </div>
                            )}

                            {/* System User Field - shown when delivery method is system */}
                            {lawEnforcementForm.delivery_method === 'system' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        System User <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={lawEnforcementForm.system_user}
                                        onChange={(e) => setLawEnforcementForm({ ...lawEnforcementForm, system_user: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter username or user ID in the law enforcement system"
                                    />
                                </div>
                            )}

                            {/* Recipient Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Recipient Name <span className="text-gray-500">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={lawEnforcementForm.recipient_name}
                                    onChange={(e) => setLawEnforcementForm({ ...lawEnforcementForm, recipient_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter recipient name"
                                />
                            </div>

                            {/* Recipient Organization */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Recipient Organization <span className="text-gray-500">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={lawEnforcementForm.recipient_organization}
                                    onChange={(e) => setLawEnforcementForm({ ...lawEnforcementForm, recipient_organization: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter organization name"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Additional Notes <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={lawEnforcementForm.notes}
                                    onChange={(e) => setLawEnforcementForm({ ...lawEnforcementForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                    placeholder="Enter any additional notes or instructions..."
                                    rows="4"
                                />
                            </div>

                            {/* Error Message */}
                            {sendToLawEnforcementMutation.isError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                    {sendToLawEnforcementMutation.error?.response?.data?.detail ||
                                        sendToLawEnforcementMutation.error?.response?.data?.message ||
                                        sendToLawEnforcementMutation.error?.message ||
                                        'Failed to send SAR to law enforcement. Please try again.'}
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
                                    setIsLawEnforcementModalOpen(false)
                                    setSelectedSAR(null)
                                    resetLawEnforcementForm()
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitLawEnforcement}
                                disabled={
                                    sendToLawEnforcementMutation.isLoading || 
                                    !lawEnforcementForm.delivery_method || 
                                    (lawEnforcementForm.delivery_method === 'email' && !lawEnforcementForm.email) ||
                                    (lawEnforcementForm.delivery_method === 'system' && !lawEnforcementForm.system_user)
                                }
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sendToLawEnforcementMutation.isLoading ? 'Sending...' : 'Send to Law Enforcement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

export default SAR
