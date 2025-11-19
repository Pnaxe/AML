import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const TransactionList = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [riskFilter, setRiskFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showSuccessNotification, setShowSuccessNotification] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [notificationType, setNotificationType] = useState('success') // 'success' or 'delete'
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState(null)
    const [validationResult, setValidationResult] = useState(null)
    const [isClearModalOpen, setIsClearModalOpen] = useState(false)
    const [isErrorsModalOpen, setIsErrorsModalOpen] = useState(false)
    const [errorLogs, setErrorLogs] = useState([])
    const [isMonitorModalOpen, setIsMonitorModalOpen] = useState(false)
    const [monitoringProgress, setMonitoringProgress] = useState({
        total: 0,
        processed: 0,
        alertsGenerated: 0,
        isRunning: false
    })

    const queryClient = useQueryClient()

    const monitorMutation = useMutation({
        mutationFn: () => {
            setIsMonitorModalOpen(true)
            setMonitoringProgress({
                total: transactions.length,
                processed: 0,
                alertsGenerated: 0,
                isRunning: true
            })
            return axios.post(`${base_url}/transactions/monitor_all/`)
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries(['transactions'])
            queryClient.invalidateQueries(['alerts'])  // Refresh alerts after monitoring
            setMonitoringProgress({
                total: response.data?.total_transactions || transactions.length,
                processed: response.data?.processed_count || transactions.length,
                alertsGenerated: response.data?.alerts_generated || 0,
                isRunning: false
            })
            setSuccessMessage(response.data?.message || 'Monitoring completed successfully')
            setNotificationType('success')
            setShowSuccessNotification(true)
            setTimeout(() => {
                setShowSuccessNotification(false)
                setSuccessMessage('')
                setNotificationType('success')
            }, 3000)
        },
        onError: (error) => {
            setMonitoringProgress(prev => ({ ...prev, isRunning: false }))
            setSuccessMessage(error.response?.data?.message || 'Failed to monitor transactions')
            setNotificationType('success')
            setShowSuccessNotification(true)
            setTimeout(() => {
                setShowSuccessNotification(false)
                setSuccessMessage('')
            }, 3000)
        },
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['transactions', searchQuery, riskFilter, typeFilter, statusFilter],
        queryFn: async () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            if (typeFilter) params.transaction_type = typeFilter
            if (statusFilter) params.status = statusFilter
            params.page_size = 10000 // Large page size to get all data at once
            
            const response = await axios.get(`${base_url}/transactions/`, { params })
            const responseData = response.data
            
            // If there are more pages, fetch them all
            let allTransactions = responseData.results || []
            let nextUrl = responseData.next
            
            while (nextUrl) {
                const nextResponse = await axios.get(nextUrl)
                const nextData = nextResponse.data
                if (nextData.results) {
                    allTransactions = [...allTransactions, ...nextData.results]
                }
                nextUrl = nextData.next
            }
            
            return {
                results: allTransactions,
                count: allTransactions.length
            }
        },
    })

    const excelImportMutation = useMutation({
        mutationFn: (file) => {
            const formData = new FormData()
            formData.append('file', file)
            return axios.post(`${base_url}/transactions/import_excel/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries(['transactions'])
            setValidationResult({
                success: true,
                message: response.data.message,
                importedCount: response.data.imported_count,
                skippedCount: response.data.skipped_count || 0,
            })
            setSuccessMessage(response.data.message || 'Transactions imported successfully')
            setNotificationType('success')
            setShowSuccessNotification(true)
            setTimeout(() => {
                setShowSuccessNotification(false)
                setSuccessMessage('')
                setNotificationType('success')
                setIsExcelModalOpen(false)
                setSelectedFile(null)
                setValidationResult(null)
            }, 3000)
        },
        onError: (error) => {
            // Handle validation errors (400 status) or other errors
            const errorData = error.response?.data || {}
            const status = error.response?.status
            
            // Check if it's a validation error with detailed errors
            if (status === 400 && errorData.validation_errors) {
                const errors = errorData.validation_errors || []
                setErrorLogs(errors)
                setIsExcelModalOpen(false)
                setIsErrorsModalOpen(true)
                setValidationResult({
                    success: false,
                    message: errorData.message || 'Validation failed',
                    errors: errors,
                    totalErrors: errorData.total_errors || errors.length || 0,
                    validRows: errorData.valid_rows || 0,
                    skippedRows: errorData.skipped_rows || 0,
                })
            } else if (status === 207) {
                // Partial success (some imported, some failed)
                queryClient.invalidateQueries(['transactions'])
                const errors = errorData.validation_errors || []
                setErrorLogs(errors)
                setIsExcelModalOpen(false)
                setIsErrorsModalOpen(true)
                setValidationResult({
                    success: false,
                    message: errorData.message || 'Import completed with errors',
                    errors: errors,
                    totalErrors: errorData.total_errors || 0,
                    validRows: errorData.valid_rows || 0,
                    skippedRows: errorData.skipped_rows || 0,
                    importedCount: errorData.imported_count || 0,
                })
            } else {
                // Other errors (missing columns, file type, etc.)
                const errors = errorData.missing_columns 
                    ? [`Missing required columns: ${errorData.missing_columns.join(', ')}`]
                    : [errorData.message || errorData.error || 'Failed to import transactions']
                setErrorLogs(errors)
                setIsExcelModalOpen(false)
                setIsErrorsModalOpen(true)
                setValidationResult({
                    success: false,
                    message: errorData.message || errorData.error || 'Failed to import transactions',
                    errors: errors,
                    totalErrors: errorData.missing_columns?.length || 1,
                    validRows: 0,
                    skippedRows: 0,
                })
            }
        },
    })

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            setSelectedFile(file)
            setValidationResult(null)
        }
    }

    const handleValidateAndImport = () => {
        if (selectedFile) {
            excelImportMutation.mutate(selectedFile)
        }
    }

    const clearDataMutation = useMutation({
        mutationFn: () => axios.delete(`${base_url}/transactions/clear_all/`),
        onSuccess: (response) => {
            queryClient.invalidateQueries(['transactions'])
            setIsClearModalOpen(false)
            setSuccessMessage(response.data?.message || 'All transactions cleared successfully')
            setNotificationType('delete')
            setShowSuccessNotification(true)
            setTimeout(() => {
                setShowSuccessNotification(false)
                setSuccessMessage('')
                setNotificationType('success')
            }, 3000)
        },
    })

    const transactions = data?.results || []

    const formatCurrency = (amount, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount)
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Transaction Monitoring</h4>
                    <small className="text-gray-500 text-xs">Real-time transaction analysis and monitoring</small>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setIsExcelModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        <span>Load Excel</span>
                    </button>
                    {!isLoading && transactions.length > 0 && (
                        <button
                            onClick={() => monitorMutation.mutate()}
                            disabled={monitorMutation.isLoading}
                            className="bg-purple-600 text-white px-4 py-2 hover:bg-purple-700 transition-all duration-200 flex items-center space-x-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                {/* Head */}
                                <circle cx="12" cy="6" r="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                {/* Torso */}
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5L12 12"/>
                                {/* Front arm (left, bent forward) */}
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10L9 8L7 10"/>
                                {/* Back arm (right, bent backward) */}
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10L15 12L17 14"/>
                                {/* Front leg (left, extended forward) */}
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L10 16L8 18"/>
                                {/* Back leg (right, bent backward) */}
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L14 16L16 18"/>
                            </svg>
                            <span>{monitorMutation.isLoading ? 'Monitoring...' : 'Monitor'}</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsClearModalOpen(true)}
                        className="bg-red-600 text-white px-4 py-2 hover:bg-red-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        <span>Clear Data</span>
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
                                placeholder="Search transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Risk Level Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Risk Level:</label>
                            <select
                                value={riskFilter}
                                onChange={(e) => setRiskFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Risk Levels</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>

                        {/* Transaction Type Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Type:</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[120px]"
                            >
                                <option value="">All Types</option>
                                <option value="WIRE">Wire Transfer</option>
                                <option value="TRANSFER">Transfer</option>
                                <option value="DEPOSIT">Deposit</option>
                                <option value="WITHDRAWAL">Withdrawal</option>
                                <option value="PAYMENT">Payment</option>
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
                                <option value="COMPLETED">Completed</option>
                                <option value="FLAGGED">Flagged</option>
                                <option value="PENDING">Pending</option>
                                <option value="UNDER_REVIEW">Under Review</option>
                            </select>
                        </div>
                    </div>
                
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* Transaction Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading transactions</div>
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
                                        TRANSACTION ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        CUSTOMER
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        AMOUNT
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        RISK SCORE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        DATE
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: Math.max(100, transactions.length) }).map((_, index) => {
                                    const transaction = transactions[index];
                                    return (
                                        <tr key={transaction?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${transaction ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {transaction?.transaction_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {transaction?.sender_name || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-semibold text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {transaction ? formatCurrency(parseFloat(transaction.amount), transaction.currency) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {transaction?.transaction_type || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {transaction ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                                        transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        transaction.status === 'FLAGGED' ? 'bg-red-100 text-red-700' :
                                                        transaction.status === 'UNDER_REVIEW' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {transaction.status}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {transaction?.risk_score ? transaction.risk_score.toFixed(2) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-500 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {transaction?.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : '\u00A0'}
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
                    {transactions.length > 0 ? `Showing all ${transactions.length} transactions` : 'No transactions found'}
                </div>
            </div>

            {/* Success Notification */}
            {showSuccessNotification && (
                <div className="fixed top-4 right-4 z-50 animate-fade-in">
                    <div className={`${notificationType === 'delete' ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-4 rounded-md shadow-lg flex items-center space-x-3 min-w-[300px]`}>
                        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {notificationType === 'delete' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            )}
                        </svg>
                        <div className="flex-1">
                            <p className="font-semibold">{notificationType === 'delete' ? 'Deleted!' : 'Success!'}</p>
                            <p className="text-sm">{successMessage || 'Operation completed successfully.'}</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowSuccessNotification(false)
                                setSuccessMessage('')
                                setNotificationType('success')
                            }}
                            className="ml-2 text-white hover:text-gray-200 flex-shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Clear Data Confirmation Modal */}
            {isClearModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Clear All Transactions</h3>
                            <button
                                onClick={() => setIsClearModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0">
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-base font-semibold text-gray-900 mb-2">Warning: This action cannot be undone</h4>
                                        <p className="text-sm text-gray-600">
                                            Are you sure you want to delete all transactions from the database? This will permanently remove all transaction records and cannot be reversed.
                                        </p>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {clearDataMutation.isError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                        {clearDataMutation.error?.response?.data?.message ||
                                            clearDataMutation.error?.message ||
                                            'Failed to clear transactions. Please try again.'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsClearModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    clearDataMutation.mutate()
                                }}
                                disabled={clearDataMutation.isLoading}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {clearDataMutation.isLoading ? 'Clearing...' : 'Clear All Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Excel Import Modal */}
            {isExcelModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Import Transactions from Excel</h3>
                            <button
                                onClick={() => {
                                    setIsExcelModalOpen(false)
                                    setSelectedFile(null)
                                    setValidationResult(null)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                {/* File Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Excel File (.xlsx or .xls)
                                    </label>
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                                        <div className="space-y-1 text-center">
                                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <div className="flex text-sm text-gray-600">
                                                <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                                    <span>Upload a file</span>
                                                    <input
                                                        type="file"
                                                        accept=".xlsx,.xls"
                                                        onChange={handleFileSelect}
                                                        className="sr-only"
                                                    />
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
                                        </div>
                                    </div>
                                    {selectedFile && (
                                        <div className="mt-2 text-sm text-gray-600">
                                            <span className="font-medium">Selected:</span> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                                        </div>
                                    )}
                                </div>

                                {/* Required Columns Info */}
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Required Columns:</h4>
                                    <div className="text-xs text-blue-800 space-y-1">
                                        <p><strong>Required:</strong> transaction_id, transaction_type, amount, sender_customer_id, transaction_date</p>
                                        <p><strong>Optional:</strong> reference_number, currency, receiver_customer_id, originating_country, destination_country, sender_account, receiver_account, sender_bank, receiver_bank, description, status, ip_address, device_id, channel</p>
                                        <p className="mt-2"><strong>Transaction Types:</strong> DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WIRE, ATM, CHECK, CARD, CRYPTO, OTHER</p>
                                        <p><strong>Status Options:</strong> PENDING, COMPLETED, FAILED, FLAGGED, UNDER_REVIEW, CLEARED, BLOCKED</p>
                                    </div>
                                </div>

                                {/* Validation Results */}
                                {validationResult && (
                                    <div className={`border rounded-md p-4 ${validationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className={`font-semibold mb-2 ${validationResult.success ? 'text-green-900' : 'text-red-900'}`}>
                                            {validationResult.success ? '✓ Import Successful' : '✗ Validation Failed'}
                                        </div>
                                        <div className={`text-sm ${validationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                            <p>{validationResult.message}</p>
                                            {validationResult.success && (
                                                <p className="mt-2">
                                                    Imported: {validationResult.importedCount} transaction(s)
                                                    {validationResult.skippedCount > 0 && `, Skipped: ${validationResult.skippedCount}`}
                                                </p>
                                            )}
                                            {!validationResult.success && validationResult.errors && validationResult.errors.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="font-medium mb-1">Validation Errors ({validationResult.totalErrors} total):</p>
                                                    <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
                                                        {validationResult.errors.slice(0, 5).map((error, idx) => (
                                                            <p key={idx} className="text-xs">{error}</p>
                                                        ))}
                                                        {validationResult.errors.length > 5 && (
                                                            <p className="text-xs italic">... and {validationResult.errors.length - 5} more errors</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setIsExcelModalOpen(false)
                                                            setIsErrorsModalOpen(true)
                                                        }}
                                                        className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                                                    >
                                                        View All Errors ({validationResult.totalErrors})
                                                    </button>
                                                    {validationResult.validRows > 0 && (
                                                        <p className="mt-2 text-xs">
                                                            Valid rows: {validationResult.validRows}, Skipped: {validationResult.skippedRows}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Error Message */}
                                {excelImportMutation.isError && !validationResult && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                        {excelImportMutation.error?.response?.data?.message ||
                                            excelImportMutation.error?.message ||
                                            'Failed to import transactions. Please try again.'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsExcelModalOpen(false)
                                    setSelectedFile(null)
                                    setValidationResult(null)
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleValidateAndImport}
                                disabled={!selectedFile || excelImportMutation.isLoading}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {excelImportMutation.isLoading ? 'Validating & Importing...' : 'Validate & Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Errors Modal */}
            {isErrorsModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Validation Error Logs</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {errorLogs.length} error(s) found during validation
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsErrorsModalOpen(false)
                                    setIsExcelModalOpen(true)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                <div className="flex items-start space-x-2">
                                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                    </svg>
                                    <div>
                                        <p className="text-sm font-semibold text-red-900">Import Failed</p>
                                        <p className="text-xs text-red-700 mt-1">
                                            Please fix the errors below and try importing again.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Error List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-900">Error Details:</h4>
                                    <span className="text-xs text-gray-500">Total: {errorLogs.length} errors</span>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-[60vh] overflow-y-auto">
                                    <div className="space-y-2">
                                        {errorLogs.map((error, idx) => (
                                            <div key={idx} className="flex items-start space-x-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50">
                                                <span className="text-xs font-mono text-gray-400 flex-shrink-0 w-8">
                                                    {idx + 1}.
                                                </span>
                                                <p className="text-xs text-gray-800 flex-1">{error}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsErrorsModalOpen(false)
                                    setIsExcelModalOpen(true)
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsErrorsModalOpen(false)
                                    setIsExcelModalOpen(true)
                                    setSelectedFile(null)
                                    setValidationResult(null)
                                    setErrorLogs([])
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                                Upload New File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Monitoring Progress Modal */}
            {isMonitorModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Transaction Monitoring</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Processing transactions through AML monitoring pipeline
                                </p>
                            </div>
                            {!monitoringProgress.isRunning && (
                                <button
                                    onClick={() => {
                                        setIsMonitorModalOpen(false)
                                        setMonitoringProgress({
                                            total: 0,
                                            processed: 0,
                                            alertsGenerated: 0,
                                            isRunning: false
                                        })
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                {/* Progress Bar */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">Progress</span>
                                        <span className="text-sm text-gray-600">
                                            {monitoringProgress.processed} / {monitoringProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className={`h-2.5 rounded-full transition-all duration-300 ${
                                                monitoringProgress.isRunning ? 'bg-purple-600' : 'bg-green-600'
                                            }`}
                                            style={{
                                                width: monitoringProgress.total > 0
                                                    ? `${(monitoringProgress.processed / monitoringProgress.total) * 100}%`
                                                    : '0%'
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className={`border rounded-md p-4 ${monitoringProgress.isRunning ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
                                    <div className="flex items-start space-x-3">
                                        {monitoringProgress.isRunning ? (
                                            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                        )}
                                        <div className="flex-1">
                                            <p className={`text-sm font-semibold ${monitoringProgress.isRunning ? 'text-purple-900' : 'text-green-900'}`}>
                                                {monitoringProgress.isRunning ? 'Monitoring in progress...' : 'Monitoring completed'}
                                            </p>
                                            <p className={`text-xs ${monitoringProgress.isRunning ? 'text-purple-700' : 'text-green-700'} mt-1`}>
                                                {monitoringProgress.isRunning
                                                    ? 'Processing transactions and calculating risk scores...'
                                                    : `Successfully processed ${monitoringProgress.processed} transaction(s)`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Statistics */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                        <div className="text-xs text-gray-500 mb-1">Total Transactions</div>
                                        <div className="text-2xl font-bold text-gray-900">{monitoringProgress.total}</div>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                        <div className="text-xs text-gray-500 mb-1">Alerts Generated</div>
                                        <div className="text-2xl font-bold text-purple-600">{monitoringProgress.alertsGenerated}</div>
                                    </div>
                                </div>

                                {/* Processing Details */}
                                {monitoringProgress.isRunning && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                        <div className="flex items-start space-x-2">
                                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            <div>
                                                <p className="text-sm font-semibold text-blue-900">Processing...</p>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Analyzing transactions for suspicious patterns, calculating risk scores, and generating alerts.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            {!monitoringProgress.isRunning && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMonitorModalOpen(false)
                                        setMonitoringProgress({
                                            total: 0,
                                            processed: 0,
                                            alertsGenerated: 0,
                                            isRunning: false
                                        })
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TransactionList
