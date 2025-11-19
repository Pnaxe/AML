import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

const Screening = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [matchTypeFilter, setMatchTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [isScreening, setIsScreening] = useState(false)
    const [screeningMessage, setScreeningMessage] = useState(null)

    const queryClient = useQueryClient()

    // Fetch screening matches
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['screening-matches', searchQuery, matchTypeFilter, statusFilter],
        queryFn: () => {
            const params = {}
            if (searchQuery) params.search = searchQuery
            if (matchTypeFilter) params.match_type = matchTypeFilter
            if (statusFilter) params.status = statusFilter
            return axios.get(`${base_url}/screening/matches/`, { params }).then(res => res.data)
        },
    })

    // Mutation to run screening
    const runScreeningMutation = useMutation({
        mutationFn: () => axios.post(`${base_url}/screening/run_screening/`),
        onMutate: () => {
            setIsScreening(true)
            setScreeningMessage(null)
        },
        onSuccess: (response) => {
            setIsScreening(false)
            const results = response.data.results || {}
            setScreeningMessage({
                type: 'success',
                message: `Screening completed! Screened ${results.screened_count || 0} customers. Found ${results.matches_found || 0} matches.`,
                details: results
            })
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                setScreeningMessage(null)
            }, 5000)
            // Refetch matches after screening
            queryClient.invalidateQueries(['screening-matches'])
        },
        onError: (error) => {
            setIsScreening(false)
            setScreeningMessage({
                type: 'error',
                message: error.response?.data?.message || error.message || 'Failed to run screening'
            })
            // Auto-dismiss error after 5 seconds
            setTimeout(() => {
                setScreeningMessage(null)
            }, 5000)
        }
    })

    const matches = data?.results || []

    const getMatchTypeBadgeClass = (matchType) => {
        switch (matchType) {
            case 'EXACT':
                return 'bg-red-100 text-red-700'
            case 'PROBABLE':
                return 'bg-orange-100 text-orange-700'
            case 'FUZZY':
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-blue-100 text-blue-700'
        }
    }

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'NEW':
                return 'bg-yellow-100 text-yellow-700'
            case 'UNDER_REVIEW':
                return 'bg-blue-100 text-blue-700'
            case 'CONFIRMED':
                return 'bg-red-100 text-red-700'
            case 'FALSE_POSITIVE':
                return 'bg-green-100 text-green-700'
            case 'ESCALATED':
                return 'bg-purple-100 text-purple-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Success/Error Popup */}
            {screeningMessage && (
                <div className="fixed top-20 right-4 z-50 animate-fade-in">
                    <div className={`shadow-lg rounded-md p-4 min-w-[300px] max-w-[400px] ${
                        screeningMessage.type === 'success' 
                            ? 'bg-green-50 border border-green-200 text-green-800' 
                            : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-medium">{screeningMessage.message}</p>
                                {screeningMessage.details && (
                                    <div className="mt-2 text-xs space-y-1">
                                        <p>PEP Matches: {screeningMessage.details.pep_matches || 0}</p>
                                        <p>Sanctions Matches: {screeningMessage.details.sanctions_matches || 0}</p>
                                        <p>Adverse Media Matches: {screeningMessage.details.adverse_media_matches || 0}</p>
                                        <p>Criminal Matches: {screeningMessage.details.criminal_matches || 0}</p>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setScreeningMessage(null)}
                                className="ml-4 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Watchlist Screening</h4>
                    <small className="text-gray-500 text-xs">Screen customers against watchlists and sanctions</small>
                </div>
                <div>
                    <button 
                        onClick={() => runScreeningMutation.mutate()}
                        disabled={isScreening || runScreeningMutation.isLoading}
                        className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isScreening || runScreeningMutation.isLoading ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                                <span>Screening...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"></path>
                                </svg>
                                <span>Run Screening</span>
                            </>
                        )}
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
                                placeholder="Search matches..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                            />
                        </div>

                        {/* Match Type Filter */}
                        <div className="flex items-center space-x-2 ml-4">
                            <label className="text-xs font-medium text-gray-700">Match Type:</label>
                            <select
                                value={matchTypeFilter}
                                onChange={(e) => setMatchTypeFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto min-w-[140px]"
                            >
                                <option value="">All Match Types</option>
                                <option value="exact">Exact Match</option>
                                <option value="probable">Probable Match</option>
                                <option value="fuzzy">Fuzzy Match</option>
                                <option value="possible">Possible Match</option>
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
                                <option value="under_review">Under Review</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="false_positive">False Positive</option>
                                <option value="escalated">Escalated</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">

                    </div>
                </div>
            </div>

            {/* Screening Matches Table */}
            <div className="bg-white flex flex-col border border-gray-200 overflow-hidden flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overflow-x-auto">

                    {/* Scrollable Table Body */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                            <div className="text-red-500 font-semibold">Error loading screening matches</div>
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
                                        MATCH ID
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        CUSTOMER
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        WATCHLIST ENTRY
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        MATCH TYPE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        STATUS
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        SCORE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap border-r border-gray-300" style={{ color: '#f3f4f6' }}>
                                        SOURCE
                                    </th>
                                    <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-black uppercase tracking-wider whitespace-nowrap" style={{ color: '#f3f4f6' }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Array.from({ length: 25 }).map((_, index) => {
                                    const match = matches[index];
                                    // Use actual match data if available
                                    const matchData = match ? {
                                        match_id: match.match_id || `MATCH-${match.id || index}`,
                                        customer_name: match.customer_name || 'N/A',
                                        watchlist_entry: match.watchlist_entry || 'N/A',
                                        match_type: match.match_type || 'FUZZY',
                                        status: match.status || 'NEW',
                                        match_score: match.match_score || 0.85,
                                        source: match.source || 'Unknown'
                                    } : null;
                                    
                                    return (
                                        <tr key={match?.id || index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'} ${matchData ? 'hover:opacity-80' : ''}`} style={{ minHeight: '36px' }}>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs font-mono text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData?.match_id || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData?.customer_name || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap truncate border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData?.watchlist_entry || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getMatchTypeBadgeClass(matchData.match_type)}`}>
                                                        {matchData.match_type}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(matchData.status)}`}>
                                                        {matchData.status}
                                                    </span>
                                                ) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-900 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData?.match_score ? matchData.match_score.toFixed(2) : '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-200" style={{ minHeight: '36px' }}>
                                                {matchData?.source || '\u00A0'}
                                            </td>
                                            <td className="px-2 md:px-3 py-1.5 md:py-2 whitespace-nowrap" style={{ minHeight: '36px' }}>
                                                {matchData ? (
                                                    <div className="flex items-center space-x-2">
                                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                                                            View
                                                        </button>
                                                        <button className="text-gray-400">|</button>
                                                        <button className="text-green-600 hover:text-green-800 text-xs font-medium">
                                                            Review
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
                    {data?.count !== undefined ? `${data.count} match${data.count !== 1 ? 'es' : ''} displayed` : 'All matches displayed'}
                </div>
            </div>
        </div>
    )
}

export default Screening
