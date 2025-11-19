import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const LawEnforcement = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    // Using alerts API as a placeholder for law enforcement requests
    // In production, this would be a law enforcement API
    const { data, isLoading, error } = useQuery({
        queryKey: ['law-enforcement', searchQuery, typeFilter, statusFilter],
        queryFn: () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            if (statusFilter) params.status = statusFilter.toUpperCase()
            return axios.get(`${base_url}/alerts/`, { params }).then(res => res.data)
        },
    })

    const requests = data?.results || []

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'APPROVED':
            case 'COMPLETED':
                return 'bg-green-100 text-green-700'
            case 'PENDING':
            case 'UNDER_REVIEW':
                return 'bg-yellow-100 text-yellow-700'
            case 'REJECTED':
            case 'DENIED':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-blue-100 text-blue-700'
        }
    }

    const getPriorityBadgeClass = (priority) => {
        switch (priority) {
            case 'URGENT':
            case 'HIGH':
                return 'bg-red-100 text-red-700'
            case 'MEDIUM':
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-green-100 text-green-700'
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Law Enforcement Portal</h4>
                    <small className="text-gray-500 text-xs">Law enforcement access and reporting</small>
                </div>
                <div>
                    <button
                        className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                        </svg>
                        <span>New Request</span>
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
                                placeholder="Search requests..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Request Type Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Type:</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Types</option>
                                <option value="data_request">Data Request</option>
                                <option value="investigation">Investigation</option>
                                <option value="subpoena">Subpoena</option>
                                <option value="warrant">Warrant</option>
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
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* Requests Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading requests</div>
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
                                        REQUEST ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        AGENCY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        REQUEST TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        PRIORITY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        REQUEST DATE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const item = requests[index];
                                    return (
                                        <tr key={item?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${item ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? `REQ-${String(item.id || index).padStart(6, '0')}` : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? `Agency ${item.id || index}` : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item?.alert_type || 'Data Request' || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(item.status || 'PENDING')}`}>
                                                        {item.status || 'Pending'}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {item ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getPriorityBadgeClass(item.severity || 'LOW')}`}>
                                                        {item.severity || 'Low'}
                                                    </span>
                                                ) : '\u00A0'}
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
                                                            Edit
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
                    {data?.count ? `Showing ${data.count} requests` : 'All requests displayed'}
                </div>
            </div>
        </div>
    )
}

export default LawEnforcement
