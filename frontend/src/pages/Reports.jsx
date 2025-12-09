import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'
import { getCurrentUser } from '../services/auth'

const Reports = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
    
    // Get current user to determine role
    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: getCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000,
    })
    
    const userRole = currentUser?.role || 'VIEWER'
    const isRegulator = userRole === 'REGULATOR'
    
    const [reportForm, setReportForm] = useState({
        name: '',
        type: 'compliance', // Default, will be updated when role is determined
        format: 'pdf',
        date_range: 'custom',
        start_date: '',
        end_date: '',
        include_charts: true,
        include_summary: true,
        description: ''
    })
    
    const queryClient = useQueryClient()
    
    // Update form type when user role is determined
    useEffect(() => {
        if (currentUser) {
            setReportForm(prev => ({
                ...prev,
                type: isRegulator ? 'regulatory_compliance' : 'compliance'
            }))
        }
    }, [currentUser, isRegulator])

    // Using alerts API as a placeholder for reports
    // In production, this would be a reports API
    const { data, isLoading, error } = useQuery({
        queryKey: ['reports', searchQuery, typeFilter, statusFilter],
        queryFn: () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            if (statusFilter) params.status = statusFilter.toUpperCase()
            return axios.get(`${base_url}/alerts/`, { params }).then(res => res.data)
        },
    })

    const reports = data?.results || []

    // Mutation for generating a report
    const generateReportMutation = useMutation({
        mutationFn: (reportData) => {
            // In a real implementation, this would call the backend API
            return Promise.resolve({ 
                message: 'Report generated successfully', 
                report: {
                    id: Date.now(),
                    ...reportData,
                    status: 'GENERATED',
                    created_at: new Date().toISOString()
                }
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['reports'])
            setIsGenerateModalOpen(false)
            resetReportForm()
        },
    })

    const resetReportForm = () => {
        setReportForm({
            name: '',
            type: isRegulator ? 'regulatory_compliance' : 'compliance',
            format: 'pdf',
            date_range: 'custom',
            start_date: '',
            end_date: '',
            include_charts: true,
            include_summary: true,
            description: ''
        })
    }

    const handleGenerateReport = () => {
        generateReportMutation.mutate(reportForm)
    }

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'COMPLETED':
            case 'GENERATED':
                return 'bg-green-100 text-green-700'
            case 'PENDING':
            case 'PROCESSING':
                return 'bg-yellow-100 text-yellow-700'
            case 'FAILED':
            case 'ERROR':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-blue-100 text-blue-700'
        }
    }

    const getTypeBadgeClass = (type) => {
        switch (type) {
            case 'COMPLIANCE':
                return 'bg-blue-100 text-blue-700'
            case 'RISK':
                return 'bg-red-100 text-red-700'
            case 'TRANSACTION':
                return 'bg-purple-100 text-purple-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Reports</h4>
                    <small className="text-gray-500 text-xs">
                        {isRegulator ? 'Regulatory oversight and compliance reports' : 'Compliance reports and analytics'}
                    </small>
                </div>
                <div>
                    <button
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                        </svg>
                        <span>Generate Report</span>
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
                                placeholder="Search reports..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Report Type Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Type:</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Types</option>
                                {isRegulator ? (
                                    <>
                                        <option value="regulatory_compliance">Regulatory Compliance</option>
                                        <option value="sar_filing">SAR Filing</option>
                                        <option value="bank_compliance">Bank Compliance Status</option>
                                        <option value="law_enforcement">Law Enforcement</option>
                                        <option value="cross_bank_analysis">Cross-Bank Analysis</option>
                                        <option value="regulatory_oversight">Regulatory Oversight</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="compliance">Compliance</option>
                                        <option value="risk">Risk</option>
                                        <option value="transaction">Transaction</option>
                                        <option value="audit">Audit</option>
                                    </>
                                )}
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
                                <option value="completed">Completed</option>
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* Reports Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading reports</div>
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
                                        REPORT ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        REPORT NAME
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        PERIOD
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        GENERATED DATE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const item = reports[index];
                                    return (
                                        <tr key={item?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${item ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? `RPT-${String(item.id || index).padStart(6, '0')}` : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item?.alert_type || `Report ${item?.id || index}` || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getTypeBadgeClass('COMPLIANCE')}`}>
                                                        Compliance
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(item.status || 'COMPLETED')}`}>
                                                        {item.status || 'Completed'}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? 'Q1 2024' : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-500 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item?.created_at ? new Date(item.created_at).toLocaleDateString() : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                                                            View
                                                        </button>
                                                        <button className="text-gray-400">|</button>
                                                        <button className="text-gray-600 hover:text-gray-800 text-xs font-medium">
                                                            Download
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
                    {data?.count ? `Showing ${data.count} reports` : 'All reports displayed'}
                </div>
            </div>

            {/* Generate Report Modal */}
            {isGenerateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Sticky */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Generate Report</h3>
                            <button
                                onClick={() => {
                                    setIsGenerateModalOpen(false)
                                    resetReportForm()
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
                            {/* Report Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Report Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={reportForm.name}
                                    onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Q1 2024 Compliance Report"
                                />
                            </div>

                            {/* Report Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Report Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={reportForm.type}
                                    onChange={(e) => setReportForm({ ...reportForm, type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {isRegulator ? (
                                        <>
                                            <option value="regulatory_compliance">Regulatory Compliance</option>
                                            <option value="sar_filing">SAR Filing Report</option>
                                            <option value="bank_compliance">Bank Compliance Status</option>
                                            <option value="law_enforcement">Law Enforcement Report</option>
                                            <option value="cross_bank_analysis">Cross-Bank Analysis</option>
                                            <option value="regulatory_oversight">Regulatory Oversight</option>
                                            <option value="sar_trends">SAR Filing Trends</option>
                                            <option value="compliance_metrics">Compliance Metrics</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="compliance">Compliance</option>
                                            <option value="risk">Risk Assessment</option>
                                            <option value="transaction">Transaction Analysis</option>
                                            <option value="audit">Audit Report</option>
                                            <option value="kyc">KYC Verification</option>
                                            <option value="screening">Screening Report</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Format */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Format <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={reportForm.format}
                                    onChange={(e) => setReportForm({ ...reportForm, format: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="pdf">PDF</option>
                                    <option value="excel">Excel (XLSX)</option>
                                    <option value="csv">CSV</option>
                                    <option value="html">HTML</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Date Range <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={reportForm.date_range}
                                    onChange={(e) => setReportForm({ ...reportForm, date_range: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                >
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="last_7_days">Last 7 Days</option>
                                    <option value="last_30_days">Last 30 Days</option>
                                    <option value="this_month">This Month</option>
                                    <option value="last_month">Last Month</option>
                                    <option value="this_quarter">This Quarter</option>
                                    <option value="last_quarter">Last Quarter</option>
                                    <option value="this_year">This Year</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                                
                                {reportForm.date_range === 'custom' && (
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Start Date
                                            </label>
                                            <input
                                                type="date"
                                                value={reportForm.start_date}
                                                onChange={(e) => setReportForm({ ...reportForm, start_date: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                End Date
                                            </label>
                                            <input
                                                type="date"
                                                value={reportForm.end_date}
                                                onChange={(e) => setReportForm({ ...reportForm, end_date: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Options */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Report Options
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={reportForm.include_charts}
                                            onChange={(e) => setReportForm({ ...reportForm, include_charts: e.target.checked })}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Include Charts and Graphs</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={reportForm.include_summary}
                                            onChange={(e) => setReportForm({ ...reportForm, include_summary: e.target.checked })}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Include Executive Summary</span>
                                    </label>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={reportForm.description}
                                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                    placeholder="Optional description or notes for this report..."
                                    rows="3"
                                />
                            </div>

                            {/* Error Message */}
                            {generateReportMutation.isError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                    {generateReportMutation.error?.response?.data?.detail ||
                                        generateReportMutation.error?.response?.data?.message ||
                                        generateReportMutation.error?.message ||
                                        'Failed to generate report. Please try again.'}
                                </div>
                            )}
                        </div>

                        {/* Footer - Sticky */}
                        <div className="bg-white border-t border-gray-200 shadow px-3 py-2 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsGenerateModalOpen(false)
                                    resetReportForm()
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateReport}
                                disabled={generateReportMutation.isLoading || !reportForm.name || !reportForm.type}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generateReportMutation.isLoading ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Reports
