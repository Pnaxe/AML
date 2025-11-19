import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const KYC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [kycStatusFilter, setKycStatusFilter] = useState('')
    const [riskFilter, setRiskFilter] = useState('')
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
    const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [verificationNotes, setVerificationNotes] = useState('')
    const [rejectionReason, setRejectionReason] = useState('')
    const [bulkRejectionReason, setBulkRejectionReason] = useState('')
    const [selectedCustomers, setSelectedCustomers] = useState([]) // Array of customer IDs for bulk operations
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['kyc', searchQuery, kycStatusFilter, riskFilter],
        queryFn: () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            if (kycStatusFilter) {
                params.kyc_verified = kycStatusFilter === 'verified'
            } else {
                // Default to unverified customers if no filter is set
                params.kyc_verified = false
            }
            if (riskFilter) params.risk_level = riskFilter.toUpperCase()
            return axios.get(`${base_url}/customers/`, { params }).then(res => res.data)
        },
    })

    const customers = data?.results || []
    const validCustomers = customers.filter(c => c && c.id)

    const getRiskBadgeClass = (riskLevel) => {
        switch (riskLevel) {
            case 'HIGH':
            case 'CRITICAL':
                return 'bg-red-100 text-red-700'
            case 'MEDIUM':
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-green-100 text-green-700'
        }
    }

    // Fetch customer details and KYC profile when modal opens
    const { data: customerDetails, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['customer-details', selectedCustomer?.id],
        queryFn: async () => {
            if (!selectedCustomer?.id) return null
            const customerResponse = await axios.get(`${base_url}/customers/${selectedCustomer.id}/`)
            const customerData = customerResponse.data
            
            // Try to fetch KYC profile
            let kycProfile = null
            try {
                const kycResponse = await axios.get(`${base_url}/kyc-profiles/`, {
                    params: { customer: customerData.id }
                })
                if (kycResponse.data.results && kycResponse.data.results.length > 0) {
                    kycProfile = kycResponse.data.results[0]
                }
            } catch (error) {
                console.log('No KYC profile found for this customer')
            }
            
            return { customer: customerData, kycProfile }
        },
        enabled: isViewModalOpen && selectedCustomer !== null
    })

    // Fetch customer details and KYC profile for verify modal
    const { data: verifyCustomerDetails, isLoading: isLoadingVerifyDetails } = useQuery({
        queryKey: ['verify-customer-details', selectedCustomer?.id],
        queryFn: async () => {
            if (!selectedCustomer?.id) return null
            const customerResponse = await axios.get(`${base_url}/customers/${selectedCustomer.id}/`)
            const customerData = customerResponse.data
            
            // Try to fetch KYC profile
            let kycProfile = null
            try {
                const kycResponse = await axios.get(`${base_url}/kyc-profiles/`, {
                    params: { customer: customerData.id }
                })
                if (kycResponse.data.results && kycResponse.data.results.length > 0) {
                    kycProfile = kycResponse.data.results[0]
                }
            } catch (error) {
                console.log('No KYC profile found for this customer')
            }
            
            return { customer: customerData, kycProfile }
        },
        enabled: isVerifyModalOpen && selectedCustomer !== null
    })

    // Mutation to verify KYC profile
    const verifyKYCMutation = useMutation({
        mutationFn: async ({ kycProfileId, verificationNotes }) => {
            // First, update verification notes if provided
            if (verificationNotes && kycProfileId) {
                try {
                    await axios.patch(`${base_url}/kyc-profiles/${kycProfileId}/`, {
                        verification_notes: verificationNotes
                    })
                } catch (error) {
                    console.error('Failed to update verification notes:', error)
                }
            }
            
            // Then verify the profile
            const response = await axios.post(`${base_url}/kyc-profiles/${kycProfileId}/verify/`)
            return response.data
        },
        onSuccess: () => {
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries(['kyc'])
            queryClient.invalidateQueries(['customer-details'])
            queryClient.invalidateQueries(['verify-customer-details'])
            queryClient.invalidateQueries(['pending-kyc-count']) // Update sidebar badge
            
            // Close modal and reset form
            setIsVerifyModalOpen(false)
            setSelectedCustomer(null)
            setVerificationNotes('')
        },
        onError: (error) => {
            console.error('Verification error:', error)
        }
    })

    // Mutation to create KYC profile if it doesn't exist
    const createKYCProfileMutation = useMutation({
        mutationFn: async ({ customerId, riskLevel }) => {
            const response = await axios.post(`${base_url}/kyc-profiles/`, {
                customer: customerId,
                verification_status: 'PENDING',
                kyc_risk_level: riskLevel || 'MEDIUM',
                due_diligence_level: 'STANDARD'
            })
            return response.data
        }
    })

    // Mutation to reject KYC profile
    const rejectKYCMutation = useMutation({
        mutationFn: async ({ kycProfileId, rejectionReason }) => {
            const response = await axios.post(`${base_url}/kyc-profiles/${kycProfileId}/reject/`, {
                rejection_reason: rejectionReason
            })
            return response.data
        },
        onSuccess: () => {
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries(['kyc'])
            queryClient.invalidateQueries(['customer-details'])
            queryClient.invalidateQueries(['verify-customer-details'])
            queryClient.invalidateQueries(['pending-kyc-count']) // Update sidebar badge
            
            // Close modal and reset form
            setIsVerifyModalOpen(false)
            setSelectedCustomer(null)
            setRejectionReason('')
            setVerificationNotes('')
        },
        onError: (error) => {
            console.error('Rejection error:', error)
        }
    })

    // Mutation for bulk verification
    const bulkVerifyMutation = useMutation({
        mutationFn: async (customerIds) => {
            const results = []
            const errors = []

            for (const customerId of customerIds) {
                try {
                    // Get or create KYC profile
                    let kycProfileId = null
                    try {
                        const kycResponse = await axios.get(`${base_url}/kyc-profiles/`, {
                            params: { customer: customerId }
                        })
                        if (kycResponse.data.results && kycResponse.data.results.length > 0) {
                            kycProfileId = kycResponse.data.results[0].id
                        } else {
                            // Create KYC profile if it doesn't exist
                            const customerResponse = await axios.get(`${base_url}/customers/${customerId}/`)
                            const newProfile = await axios.post(`${base_url}/kyc-profiles/`, {
                                customer: customerId,
                                verification_status: 'PENDING',
                                kyc_risk_level: customerResponse.data.risk_level || 'MEDIUM',
                                due_diligence_level: 'STANDARD'
                            })
                            kycProfileId = newProfile.data.id
                        }
                    } catch (error) {
                        errors.push({ customerId, error: 'Failed to get/create KYC profile' })
                        continue
                    }

                    // Verify the profile
                    await axios.post(`${base_url}/kyc-profiles/${kycProfileId}/verify/`)
                    results.push({ customerId, success: true })
                } catch (error) {
                    errors.push({ customerId, error: error.message })
                }
            }

            return { results, errors }
        },
        onSuccess: (data) => {
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries(['kyc'])
            queryClient.invalidateQueries(['pending-kyc-count']) // Update sidebar badge
            
            // Clear selected customers
            setSelectedCustomers([])
            
            // Show summary
            const successCount = data.results.length
            const errorCount = data.errors.length
            if (errorCount > 0) {
                alert(`Bulk verification completed: ${successCount} approved, ${errorCount} failed.`)
            } else {
                alert(`Successfully approved ${successCount} customer(s).`)
            }
        },
        onError: (error) => {
            console.error('Bulk verification error:', error)
            alert('Bulk verification failed. Please try again.')
        }
    })

    // Mutation for bulk rejection
    const bulkRejectMutation = useMutation({
        mutationFn: async ({ customerIds, rejectionReason }) => {
            const results = []
            const errors = []

            for (const customerId of customerIds) {
                try {
                    // Get or create KYC profile
                    let kycProfileId = null
                    try {
                        const kycResponse = await axios.get(`${base_url}/kyc-profiles/`, {
                            params: { customer: customerId }
                        })
                        if (kycResponse.data.results && kycResponse.data.results.length > 0) {
                            kycProfileId = kycResponse.data.results[0].id
                        } else {
                            // Create KYC profile if it doesn't exist
                            const customerResponse = await axios.get(`${base_url}/customers/${customerId}/`)
                            const newProfile = await axios.post(`${base_url}/kyc-profiles/`, {
                                customer: customerId,
                                verification_status: 'PENDING',
                                kyc_risk_level: customerResponse.data.risk_level || 'MEDIUM',
                                due_diligence_level: 'STANDARD'
                            })
                            kycProfileId = newProfile.data.id
                        }
                    } catch (error) {
                        errors.push({ customerId, error: 'Failed to get/create KYC profile' })
                        continue
                    }

                    // Reject the profile
                    await axios.post(`${base_url}/kyc-profiles/${kycProfileId}/reject/`, {
                        rejection_reason: rejectionReason
                    })
                    results.push({ customerId, success: true })
                } catch (error) {
                    errors.push({ customerId, error: error.message })
                }
            }

            return { results, errors }
        },
        onSuccess: (data) => {
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries(['kyc'])
            queryClient.invalidateQueries(['pending-kyc-count']) // Update sidebar badge
            
            // Clear selected customers and close modal
            setSelectedCustomers([])
            setIsBulkRejectModalOpen(false)
            setBulkRejectionReason('')
            
            // Show summary
            const successCount = data.results.length
            const errorCount = data.errors.length
            if (errorCount > 0) {
                alert(`Bulk rejection completed: ${successCount} rejected, ${errorCount} failed.`)
            } else {
                alert(`Successfully rejected ${successCount} customer(s).`)
            }
        },
        onError: (error) => {
            console.error('Bulk rejection error:', error)
            alert('Bulk rejection failed. Please try again.')
        }
    })

    // Handle checkbox toggle for individual customer
    const handleCustomerToggle = (customerId) => {
        setSelectedCustomers(prev => {
            if (prev.includes(customerId)) {
                return prev.filter(id => id !== customerId)
            } else {
                return [...prev, customerId]
            }
        })
    }

    // Handle select all
    const handleSelectAll = () => {
        if (selectedCustomers.length === validCustomers.length) {
            setSelectedCustomers([])
        } else {
            setSelectedCustomers(validCustomers.map(c => c.id))
        }
    }

    // Handle bulk verify
    const handleBulkVerify = () => {
        if (selectedCustomers.length === 0) {
            alert('Please select at least one customer to verify.')
            return
        }
        
        if (window.confirm(`Are you sure you want to approve ${selectedCustomers.length} customer(s)?`)) {
            bulkVerifyMutation.mutate(selectedCustomers)
        }
    }

    // Handle bulk reject
    const handleBulkReject = () => {
        if (selectedCustomers.length === 0) {
            alert('Please select at least one customer to reject.')
            return
        }
        
        setIsBulkRejectModalOpen(true)
    }

    const handleBulkRejectSubmit = () => {
        if (!bulkRejectionReason.trim()) {
            alert('Please provide a reason for rejection.')
            return
        }
        
        bulkRejectMutation.mutate({
            customerIds: selectedCustomers,
            rejectionReason: bulkRejectionReason.trim()
        })
    }

    const handleCloseBulkRejectModal = () => {
        setIsBulkRejectModalOpen(false)
        setBulkRejectionReason('')
    }

    const handleViewClick = (customer) => {
        setSelectedCustomer(customer)
        setIsViewModalOpen(true)
    }

    const handleVerifyClick = (customer) => {
        setSelectedCustomer(customer)
        setIsVerifyModalOpen(true)
        setVerificationNotes('')
        setRejectionReason('')
    }

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false)
        setSelectedCustomer(null)
    }

    const handleCloseVerifyModal = () => {
        setIsVerifyModalOpen(false)
        setSelectedCustomer(null)
        setVerificationNotes('')
        setRejectionReason('')
    }

    const handleVerifySubmit = async () => {
        if (!verifyCustomerDetails) return

        let kycProfileId = null

        // Check if KYC profile exists
        if (verifyCustomerDetails.kycProfile) {
            kycProfileId = verifyCustomerDetails.kycProfile.id
        } else {
            // Create KYC profile first
            try {
                const newProfile = await createKYCProfileMutation.mutateAsync({
                    customerId: verifyCustomerDetails.customer.id,
                    riskLevel: verifyCustomerDetails.customer.risk_level
                })
                kycProfileId = newProfile.id
            } catch (error) {
                console.error('Failed to create KYC profile:', error)
                alert('Failed to create KYC profile. Please try again.')
                return
            }
        }

        // Verify the profile
        verifyKYCMutation.mutate({
            kycProfileId,
            verificationNotes
        })
    }

    const handleRejectSubmit = async () => {
        if (!verifyCustomerDetails) return

        // Rejection reason is required
        if (!rejectionReason.trim()) {
            alert('Please provide a reason for rejection.')
            return
        }

        let kycProfileId = null

        // Check if KYC profile exists
        if (verifyCustomerDetails.kycProfile) {
            kycProfileId = verifyCustomerDetails.kycProfile.id
        } else {
            // Create KYC profile first
            try {
                const newProfile = await createKYCProfileMutation.mutateAsync({
                    customerId: verifyCustomerDetails.customer.id,
                    riskLevel: verifyCustomerDetails.customer.risk_level
                })
                kycProfileId = newProfile.id
            } catch (error) {
                console.error('Failed to create KYC profile:', error)
                alert('Failed to create KYC profile. Please try again.')
                return
            }
        }

        // Reject the profile
        rejectKYCMutation.mutate({
            kycProfileId,
            rejectionReason: rejectionReason.trim()
        })
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">KYC Verification</h4>
                    <small className="text-gray-500 text-xs">Know Your Customer verification and compliance</small>
                </div>
                <div className="flex items-center space-x-3">
                    {selectedCustomers.length > 0 && (
                        <span className="text-sm text-gray-600">
                            {selectedCustomers.length} selected
                        </span>
                    )}
                    <button 
                        onClick={handleBulkReject}
                        disabled={selectedCustomers.length === 0 || bulkRejectMutation.isLoading || bulkVerifyMutation.isLoading}
                        className="bg-red-600 text-white px-4 py-2 hover:bg-red-700 transition-all duration-200 flex items-center space-x-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                        </svg>
                        <span>{bulkRejectMutation.isLoading ? 'Rejecting...' : 'Bulk Reject'}</span>
                    </button>
                    <button 
                        onClick={handleBulkVerify}
                        disabled={selectedCustomers.length === 0 || bulkVerifyMutation.isLoading || bulkRejectMutation.isLoading}
                        className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                        </svg>
                        <span>{bulkVerifyMutation.isLoading ? 'Approving...' : 'Bulk Approve'}</span>
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
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* KYC Status Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">KYC Status:</label>
                            <select
                                value={kycStatusFilter}
                                onChange={(e) => setKycStatusFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[120px]"
                            >
                                <option value="">All Status</option>
                                <option value="verified">Verified</option>
                                <option value="pending">Pending</option>
                                <option value="rejected">Rejected</option>
                            </select>
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
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* KYC Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading KYC data</div>
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
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        <input
                                            type="checkbox"
                                            checked={validCustomers.length > 0 && selectedCustomers.length === validCustomers.length}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        CUSTOMER ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        NAME
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        EMAIL
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        KYC STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        RISK LEVEL
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        VERIFICATION DATE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const customer = customers[index];
                                    return (
                                        <tr key={customer?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${customer ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-center whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCustomers.includes(customer.id)}
                                                        onChange={() => handleCustomerToggle(customer.id)}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer?.customer_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer ? (
                                                    customer.customer_type === 'INDIVIDUAL' 
                                                        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'N/A'
                                                        : customer.company_name || 'N/A'
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer?.email || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                                        customer.kyc_verified 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {customer.kyc_verified ? 'Verified' : 'Pending'}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getRiskBadgeClass(customer.risk_level)}`}>
                                                        {customer.risk_level || 'LOW'}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-500 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {customer?.kyc_verification_date ? new Date(customer.kyc_verification_date).toLocaleDateString() : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {customer ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button 
                                                            onClick={() => handleViewClick(customer)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            View
                                                        </button>
                                                        <button className="text-gray-400">|</button>
                                                        <button 
                                                            onClick={() => handleVerifyClick(customer)}
                                                            className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                                                        >
                                                            Verify
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
                    {data?.count ? `Showing ${data.count} customers` : 'All customers displayed'}
                </div>
            </div>

            {/* View KYC Modal */}
            {isViewModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">KYC Verification Details</h3>
                            <button
                                onClick={handleCloseViewModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {isLoadingDetails ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-gray-500">Loading customer details...</div>
                                </div>
                            ) : customerDetails ? (
                                <>
                                    {/* Customer Information Section */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h4>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="font-medium text-gray-600">Customer ID:</span>
                                                <p className="text-gray-900 font-mono">{customerDetails.customer?.customer_id || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Customer Type:</span>
                                                <p className="text-gray-900">{customerDetails.customer?.customer_type || 'N/A'}</p>
                                            </div>
                                            {customerDetails.customer?.customer_type === 'INDIVIDUAL' ? (
                                                <>
                                                    <div>
                                                        <span className="font-medium text-gray-600">First Name:</span>
                                                        <p className="text-gray-900">{customerDetails.customer?.first_name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-gray-600">Last Name:</span>
                                                        <p className="text-gray-900">{customerDetails.customer?.last_name || 'N/A'}</p>
                                                    </div>
                                                    {customerDetails.customer?.date_of_birth && (
                                                        <div>
                                                            <span className="font-medium text-gray-600">Date of Birth:</span>
                                                            <p className="text-gray-900">{new Date(customerDetails.customer.date_of_birth).toLocaleDateString()}</p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <div>
                                                        <span className="font-medium text-gray-600">Company Name:</span>
                                                        <p className="text-gray-900">{customerDetails.customer?.company_name || 'N/A'}</p>
                                                    </div>
                                                    {customerDetails.customer?.registration_number && (
                                                        <div>
                                                            <span className="font-medium text-gray-600">Registration Number:</span>
                                                            <p className="text-gray-900">{customerDetails.customer.registration_number}</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            <div>
                                                <span className="font-medium text-gray-600">Email:</span>
                                                <p className="text-gray-900">{customerDetails.customer?.email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Phone Number:</span>
                                                <p className="text-gray-900">{customerDetails.customer?.phone_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Address:</span>
                                                <p className="text-gray-900">{customerDetails.customer?.address || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">City:</span>
                                                <p className="text-gray-900">{customerDetails.customer?.city || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Country:</span>
                                                <p className="text-gray-900">{customerDetails.customer?.country || 'N/A'}</p>
                                            </div>
                                            {customerDetails.customer?.postal_code && (
                                                <div>
                                                    <span className="font-medium text-gray-600">Postal Code:</span>
                                                    <p className="text-gray-900">{customerDetails.customer.postal_code}</p>
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium text-gray-600">Risk Level:</span>
                                                <p className={`font-semibold ${
                                                    customerDetails.customer?.risk_level === 'HIGH' || customerDetails.customer?.risk_level === 'CRITICAL' ? 'text-red-700' :
                                                    customerDetails.customer?.risk_level === 'MEDIUM' ? 'text-yellow-700' :
                                                    'text-green-700'
                                                }`}>
                                                    {customerDetails.customer?.risk_level || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">KYC Verified:</span>
                                                <p className={customerDetails.customer?.kyc_verified ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                                                    {customerDetails.customer?.kyc_verified ? 'Yes' : 'No'}
                                                </p>
                                            </div>
                                            {customerDetails.customer?.is_pep && (
                                                <div>
                                                    <span className="font-medium text-gray-600">PEP Status:</span>
                                                    <p className="text-red-600 font-semibold">Politically Exposed Person</p>
                                                </div>
                                            )}
                                            {customerDetails.customer?.is_sanctioned && (
                                                <div>
                                                    <span className="font-medium text-gray-600">Sanctions Status:</span>
                                                    <p className="text-red-600 font-semibold">Sanctioned</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* KYC Profile Section */}
                                    {customerDetails.kycProfile ? (
                                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-3">KYC Profile Information</h4>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="font-medium text-gray-600">Verification Status:</span>
                                                    <p className={`font-semibold ${
                                                        customerDetails.kycProfile.verification_status === 'VERIFIED' ? 'text-green-600' :
                                                        customerDetails.kycProfile.verification_status === 'REJECTED' ? 'text-red-600' :
                                                        'text-yellow-600'
                                                    }`}>
                                                        {customerDetails.kycProfile.verification_status || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-600">KYC Risk Level:</span>
                                                    <p className={`font-semibold ${
                                                        customerDetails.kycProfile.kyc_risk_level === 'HIGH' || customerDetails.kycProfile.kyc_risk_level === 'CRITICAL' ? 'text-red-700' :
                                                        customerDetails.kycProfile.kyc_risk_level === 'MEDIUM' ? 'text-yellow-700' :
                                                        'text-green-700'
                                                    }`}>
                                                        {customerDetails.kycProfile.kyc_risk_level || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-600">Due Diligence Level:</span>
                                                    <p className="text-gray-900">{customerDetails.kycProfile.due_diligence_level || 'N/A'}</p>
                                                </div>
                                                {customerDetails.kycProfile.verification_date && (
                                                    <div>
                                                        <span className="font-medium text-gray-600">Verification Date:</span>
                                                        <p className="text-gray-900">{new Date(customerDetails.kycProfile.verification_date).toLocaleDateString()}</p>
                                                    </div>
                                                )}
                                                {customerDetails.kycProfile.verification_expiry && (
                                                    <div>
                                                        <span className="font-medium text-gray-600">Verification Expiry:</span>
                                                        <p className="text-gray-900">{new Date(customerDetails.kycProfile.verification_expiry).toLocaleDateString()}</p>
                                                    </div>
                                                )}
                                                {customerDetails.kycProfile.assigned_officer_username && (
                                                    <div>
                                                        <span className="font-medium text-gray-600">Assigned Officer:</span>
                                                        <p className="text-gray-900">{customerDetails.kycProfile.assigned_officer_username}</p>
                                                    </div>
                                                )}
                                                {customerDetails.kycProfile.verified_by_username && (
                                                    <div>
                                                        <span className="font-medium text-gray-600">Verified By:</span>
                                                        <p className="text-gray-900">{customerDetails.kycProfile.verified_by_username}</p>
                                                    </div>
                                                )}
                                                {customerDetails.kycProfile.requires_edd && (
                                                    <div>
                                                        <span className="font-medium text-gray-600">Requires EDD:</span>
                                                        <p className={customerDetails.kycProfile.requires_edd ? 'text-red-600 font-semibold' : 'text-green-600'}>
                                                            {customerDetails.kycProfile.requires_edd ? 'Yes' : 'No'}
                                                        </p>
                                                    </div>
                                                )}
                                                {customerDetails.kycProfile.edd_completed && (
                                                    <div>
                                                        <span className="font-medium text-gray-600">EDD Completed:</span>
                                                        <p className={customerDetails.kycProfile.edd_completed ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
                                                            {customerDetails.kycProfile.edd_completed ? 'Yes' : 'No'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {customerDetails.kycProfile.source_of_funds && (
                                                <div className="mt-3 pt-3 border-t border-gray-300">
                                                    <span className="font-medium text-gray-600 text-xs">Source of Funds:</span>
                                                    <p className="text-gray-900 text-xs mt-1">{customerDetails.kycProfile.source_of_funds}</p>
                                                </div>
                                            )}

                                            {customerDetails.kycProfile.source_of_wealth && (
                                                <div className="mt-3 pt-3 border-t border-gray-300">
                                                    <span className="font-medium text-gray-600 text-xs">Source of Wealth:</span>
                                                    <p className="text-gray-900 text-xs mt-1">{customerDetails.kycProfile.source_of_wealth}</p>
                                                </div>
                                            )}

                                            {customerDetails.kycProfile.verification_notes && (
                                                <div className="mt-3 pt-3 border-t border-gray-300">
                                                    <span className="font-medium text-gray-600 text-xs">Verification Notes:</span>
                                                    <p className="text-gray-900 text-xs mt-1">{customerDetails.kycProfile.verification_notes}</p>
                                                </div>
                                            )}

                                            {customerDetails.kycProfile.rejection_reason && (
                                                <div className="mt-3 pt-3 border-t border-red-300 bg-red-50 rounded p-2">
                                                    <span className="font-medium text-red-600 text-xs">Rejection Reason:</span>
                                                    <p className="text-red-700 text-xs mt-1">{customerDetails.kycProfile.rejection_reason}</p>
                                                </div>
                                            )}

                                            {customerDetails.kycProfile.edd_reason && (
                                                <div className="mt-3 pt-3 border-t border-gray-300">
                                                    <span className="font-medium text-gray-600 text-xs">EDD Reason:</span>
                                                    <p className="text-gray-900 text-xs mt-1">{customerDetails.kycProfile.edd_reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                                            <p className="text-xs text-yellow-800">
                                                <span className="font-semibold">Note:</span> No KYC profile found for this customer. KYC verification has not been completed yet.
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-red-500">Failed to load customer details</div>
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-3 py-2 flex justify-end space-x-3 flex-shrink-0" style={{
                            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            <button
                                type="button"
                                onClick={handleCloseViewModal}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verify KYC Modal */}
            {isVerifyModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Approve/Reject KYC</h3>
                                <p className="text-xs text-gray-600 mt-1">Approve or reject customer KYC verification</p>
                            </div>
                            <button
                                onClick={handleCloseVerifyModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {isLoadingVerifyDetails ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-gray-500">Loading customer details...</div>
                                </div>
                            ) : verifyCustomerDetails ? (
                                <>
                                    {/* Customer Summary */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h4>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="font-medium text-gray-600">Customer ID:</span>
                                                <p className="text-gray-900 font-mono">{verifyCustomerDetails.customer?.customer_id || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Name:</span>
                                                <p className="text-gray-900">
                                                    {verifyCustomerDetails.customer?.customer_type === 'INDIVIDUAL'
                                                        ? `${verifyCustomerDetails.customer?.first_name || ''} ${verifyCustomerDetails.customer?.last_name || ''}`.trim() || 'N/A'
                                                        : verifyCustomerDetails.customer?.company_name || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Email:</span>
                                                <p className="text-gray-900">{verifyCustomerDetails.customer?.email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-600">Risk Level:</span>
                                                <p className={`font-semibold ${
                                                    verifyCustomerDetails.customer?.risk_level === 'HIGH' || verifyCustomerDetails.customer?.risk_level === 'CRITICAL' ? 'text-red-700' :
                                                    verifyCustomerDetails.customer?.risk_level === 'MEDIUM' ? 'text-yellow-700' :
                                                    'text-green-700'
                                                }`}>
                                                    {verifyCustomerDetails.customer?.risk_level || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KYC Profile Status */}
                                    {verifyCustomerDetails.kycProfile ? (
                                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                            <h4 className="text-sm font-semibold text-blue-900 mb-2">Current KYC Status</h4>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="font-medium text-blue-700">Verification Status:</span>
                                                    <p className={`font-semibold ${
                                                        verifyCustomerDetails.kycProfile.verification_status === 'VERIFIED' ? 'text-green-600' :
                                                        verifyCustomerDetails.kycProfile.verification_status === 'REJECTED' ? 'text-red-600' :
                                                        'text-yellow-600'
                                                    }`}>
                                                        {verifyCustomerDetails.kycProfile.verification_status || 'PENDING'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="font-medium text-blue-700">KYC Risk Level:</span>
                                                    <p className={`font-semibold ${
                                                        verifyCustomerDetails.kycProfile.kyc_risk_level === 'HIGH' || verifyCustomerDetails.kycProfile.kyc_risk_level === 'CRITICAL' ? 'text-red-700' :
                                                        verifyCustomerDetails.kycProfile.kyc_risk_level === 'MEDIUM' ? 'text-yellow-700' :
                                                        'text-green-700'
                                                    }`}>
                                                        {verifyCustomerDetails.kycProfile.kyc_risk_level || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                                            <p className="text-xs text-yellow-800">
                                                <span className="font-semibold">Note:</span> No KYC profile exists for this customer. A new KYC profile will be created automatically when you approve.
                                            </p>
                                        </div>
                                    )}

                                    {/* Verification Notes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Verification Notes <span className="text-gray-400">(Optional - for approval)</span>
                                        </label>
                                        <textarea
                                            value={verificationNotes}
                                            onChange={(e) => setVerificationNotes(e.target.value)}
                                            placeholder="Add any notes about the approval process..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                            rows="4"
                                        />
                                    </div>

                                    {/* Rejection Reason */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rejection Reason <span className="text-gray-400">(Required for rejection)</span>
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Provide a reason for rejecting this KYC verification..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[100px]"
                                            rows="4"
                                        />
                                    </div>

                                    {/* Warning for already verified */}
                                    {verifyCustomerDetails.kycProfile?.verification_status === 'VERIFIED' && (
                                        <div className="bg-green-50 border border-green-200 rounded-md p-4">
                                            <p className="text-xs text-green-800">
                                                <span className="font-semibold">Note:</span> This customer is already verified. Approving again will update the verification date.
                                            </p>
                                        </div>
                                    )}

                                    {/* Error Messages */}
                                    {verifyKYCMutation.isError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                            {verifyKYCMutation.error?.response?.data?.detail ||
                                                verifyKYCMutation.error?.response?.data?.message ||
                                                verifyKYCMutation.error?.message ||
                                                'Failed to approve KYC. Please try again.'}
                                        </div>
                                    )}

                                    {rejectKYCMutation.isError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                            {rejectKYCMutation.error?.response?.data?.detail ||
                                                rejectKYCMutation.error?.response?.data?.message ||
                                                rejectKYCMutation.error?.message ||
                                                'Failed to reject KYC. Please try again.'}
                                        </div>
                                    )}

                                    {/* Success Messages */}
                                    {verifyKYCMutation.isSuccess && (
                                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                                            KYC approved successfully!
                                        </div>
                                    )}

                                    {rejectKYCMutation.isSuccess && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                            KYC rejected successfully!
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-red-500">Failed to load customer details</div>
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleCloseVerifyModal}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                disabled={verifyKYCMutation.isLoading || rejectKYCMutation.isLoading || createKYCProfileMutation.isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectSubmit}
                                disabled={verifyKYCMutation.isLoading || rejectKYCMutation.isLoading || createKYCProfileMutation.isLoading || isLoadingVerifyDetails}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {rejectKYCMutation.isLoading || createKYCProfileMutation.isLoading ? 'Rejecting...' : 'Reject'}
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifySubmit}
                                disabled={verifyKYCMutation.isLoading || rejectKYCMutation.isLoading || createKYCProfileMutation.isLoading || isLoadingVerifyDetails}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {verifyKYCMutation.isLoading || createKYCProfileMutation.isLoading ? 'Approving...' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Reject Modal */}
            {isBulkRejectModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Bulk Reject KYC</h3>
                                <p className="text-xs text-gray-600 mt-1">Reject {selectedCustomers.length} selected customer(s)</p>
                            </div>
                            <button
                                onClick={handleCloseBulkRejectModal}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={bulkRejectMutation.isLoading}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Selected Customers Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Selected Customers</h4>
                                <p className="text-xs text-gray-600">
                                    You are about to reject <span className="font-semibold">{selectedCustomers.length}</span> customer(s).
                                </p>
                            </div>

                            {/* Rejection Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rejection Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={bulkRejectionReason}
                                    onChange={(e) => setBulkRejectionReason(e.target.value)}
                                    placeholder="Provide a reason for rejecting these KYC verifications..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px]"
                                    rows="5"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This reason will be applied to all selected customers.
                                </p>
                            </div>

                            {/* Warning */}
                            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                <p className="text-xs text-red-800">
                                    <span className="font-semibold">Warning:</span> This action will reject all selected customers. This action cannot be undone easily.
                                </p>
                            </div>

                            {/* Error Message */}
                            {bulkRejectMutation.isError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                    {bulkRejectMutation.error?.response?.data?.detail ||
                                        bulkRejectMutation.error?.response?.data?.message ||
                                        bulkRejectMutation.error?.message ||
                                        'Failed to reject customers. Please try again.'}
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleCloseBulkRejectModal}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                disabled={bulkRejectMutation.isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkRejectSubmit}
                                disabled={bulkRejectMutation.isLoading || !bulkRejectionReason.trim()}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {bulkRejectMutation.isLoading ? 'Rejecting...' : 'Reject All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default KYC
