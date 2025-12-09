import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js'
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
)

const RegulatorDashboard = () => {
    // Fetch SAR data
    const { data: sarData } = useQuery({
        queryKey: ['sar'],
        queryFn: () => axios.get(`${base_url}/customers/`).then(res => res.data),
    })

    // Fetch law enforcement data
    const { data: lawEnforcementData } = useQuery({
        queryKey: ['law-enforcement'],
        queryFn: () => axios.get(`${base_url}/alerts/`).then(res => res.data),
    })

    // Calculate stats for regulators
    const sarReports = sarData?.results || []
    const lawEnforcementRequests = lawEnforcementData?.results || []

    const stats = {
        total_sars: sarReports.length || 156,
        pending_sars: sarReports.filter(s => s.risk_level === 'HIGH').length || 24,
        filed_sars: sarReports.filter(s => s.risk_level === 'MEDIUM').length || 98,
        sent_to_compliance: sarReports.filter(s => s.risk_level === 'LOW').length || 34,
        law_enforcement_requests: lawEnforcementRequests.length || 42,
        pending_requests: lawEnforcementRequests.filter(r => r.status === 'NEW' || r.status === 'PENDING').length || 12,
        completed_requests: lawEnforcementRequests.filter(r => r.status === 'RESOLVED').length || 28,
        banks_under_review: 8,
    }

    // SAR Filing Trends
    const sarTrendsData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'SARs Filed',
                data: [45, 52, 48, 61, 58, 67],
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Sent to Compliance',
                data: [12, 15, 18, 14, 20, 24],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    }

    // SAR Status Distribution
    const sarStatusData = {
        labels: ['Filed', 'Pending Review', 'Sent to Compliance', 'Under Investigation'],
        datasets: [{
            data: [98, 24, 34, 12],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ]
        }]
    }

    // Law Enforcement Request Types
    const requestTypesData = {
        labels: ['Data Request', 'Investigation', 'Subpoena', 'Warrant'],
        datasets: [{
            label: 'Requests',
            data: [18, 12, 8, 4],
            backgroundColor: 'rgba(59, 130, 246, 0.8)'
        }]
    }

    // Bank Compliance Status
    const bankComplianceData = {
        labels: ['Compliant', 'Under Review', 'Non-Compliant', 'Pending'],
        datasets: [{
            data: [45, 25, 8, 12],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(156, 163, 175, 0.8)'
            ]
        }]
    }

    // Monthly SAR Filing Volume
    const monthlySarVolumeData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'SARs Received',
            data: [45, 52, 48, 61, 58, 67],
            backgroundColor: 'rgba(59, 130, 246, 0.8)'
        }]
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        }
    }

    const lineChartOptions = {
        ...chartOptions,
        plugins: {
            legend: {
                display: true,
                position: 'bottom'
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }

    const barChartOptions = {
        ...chartOptions,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">Regulatory Compliance Dashboard</h4>
                    <small className="text-gray-500 text-xs">Regulatory oversight and compliance monitoring</small>
                </div>
            </div>

            {/* Critical Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Total SARs */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Total SARs</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.total_sars.toLocaleString()}</h3>
                        <p className="text-xs text-blue-600 mt-0.5">↑ 12.5% from last month</p>
                    </div>
                </div>

                {/* Pending SARs */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Pending Review</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.pending_sars}</h3>
                        <p className="text-xs text-yellow-600 mt-0.5">5 require immediate attention</p>
                    </div>
                </div>

                {/* Law Enforcement Requests */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-purple-100 text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Law Enforcement Requests</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.law_enforcement_requests}</h3>
                        <p className="text-xs text-purple-600 mt-0.5">{stats.pending_requests} pending</p>
                    </div>
                </div>

                {/* Banks Under Review */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-red-100 text-red-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Banks Under Review</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.banks_under_review}</h3>
                        <p className="text-xs text-red-600 mt-0.5">3 require action</p>
                    </div>
                </div>
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                {/* SAR Filing Trends */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h6 className="text-sm font-semibold text-gray-900">SAR Filing Trends</h6>
                            <p className="text-xs text-gray-500 mt-1">Last 6 months</p>
                        </div>
                    </div>
                    <div style={{ height: '250px' }}>
                        <Line data={sarTrendsData} options={lineChartOptions} />
                    </div>
                </div>

                {/* SAR Status Distribution */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h6 className="text-sm font-semibold text-gray-900">SAR Status Distribution</h6>
                            <p className="text-xs text-gray-500 mt-1">Current status overview</p>
                        </div>
                    </div>
                    <div style={{ height: '250px' }}>
                        <Bar data={sarStatusData} options={barChartOptions} />
                    </div>
                </div>
            </div>

            {/* Second Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {/* Bank Compliance Status */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">Bank Compliance Status</h6>
                    <div style={{ height: '200px' }}>
                        <Doughnut data={bankComplianceData} options={chartOptions} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                                <span className="text-gray-600">Compliant</span>
                            </div>
                            <span className="font-semibold">45</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                                <span className="text-gray-600">Under Review</span>
                            </div>
                            <span className="font-semibold">25</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                                <span className="text-gray-600">Non-Compliant</span>
                            </div>
                            <span className="font-semibold">8</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-gray-500 mr-2"></span>
                                <span className="text-gray-600">Pending</span>
                            </div>
                            <span className="font-semibold">12</span>
                        </div>
                    </div>
                </div>

                {/* Law Enforcement Request Types */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">Law Enforcement Request Types</h6>
                    <div style={{ height: '200px' }}>
                        <Pie data={requestTypesData} options={chartOptions} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                <span className="text-gray-600">Data Request</span>
                            </div>
                            <span className="font-semibold">18</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-purple-500 mr-2"></span>
                                <span className="text-gray-600">Investigation</span>
                            </div>
                            <span className="font-semibold">12</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                                <span className="text-gray-600">Subpoena</span>
                            </div>
                            <span className="font-semibold">8</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                                <span className="text-gray-600">Warrant</span>
                            </div>
                            <span className="font-semibold">4</span>
                        </div>
                    </div>
                </div>

                {/* Monthly SAR Volume */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">Monthly SAR Volume</h6>
                    <div style={{ height: '200px' }}>
                        <Bar data={monthlySarVolumeData} options={barChartOptions} />
                    </div>
                </div>
            </div>

            {/* Recent SARs Table */}
            <div className="bg-white rounded-lg p-3 shadow-md mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                    <h6 className="text-sm font-semibold text-gray-900">Recent SAR Filings</h6>
                    <a href="/sar" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All →</a>
                </div>
                <div className="overflow-x-auto -mx-3 px-3">
                    <table className="w-full text-xs min-w-[600px]">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-2 font-semibold text-gray-700">SAR Number</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700">Subject</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700 hidden sm:table-cell">Activity Type</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700">Status</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700 hidden md:table-cell">Priority</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700 hidden lg:table-cell">Filing Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sarReports.slice(0, 5).map((sar, idx) => {
                                const sarData = {
                                    sar_number: `SAR-${sar.id || idx}`,
                                    subject: sar.customer_type === 'INDIVIDUAL'
                                        ? `${sar.first_name || ''} ${sar.last_name || ''}`.trim() || 'N/A'
                                        : sar.company_name || 'N/A',
                                    activity_type: sar.is_sanctioned ? 'Sanctions Violation' : sar.is_pep ? 'Corruption' : 'Money Laundering',
                                    status: 'FILED',
                                    priority: sar.risk_level === 'HIGH' ? 'URGENT' : sar.risk_level === 'MEDIUM' ? 'PRIORITY' : 'ROUTINE',
                                    filing_date: sar.updated_at ? new Date(sar.updated_at).toLocaleDateString() : 'N/A'
                                }
                                return (
                                    <tr key={sar.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-2 font-mono text-xs">{sarData.sar_number}</td>
                                        <td className="py-3 px-2">{sarData.subject}</td>
                                        <td className="py-3 px-2 hidden sm:table-cell">{sarData.activity_type}</td>
                                        <td className="py-3 px-2">
                                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                                {sarData.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 hidden md:table-cell">
                                            <span className={`px-2 py-1 rounded-full text-xs ${sarData.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                                                sarData.priority === 'PRIORITY' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {sarData.priority}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-gray-500 hidden lg:table-cell">{sarData.filing_date}</td>
                                    </tr>
                                )
                            }) || (
                                    <tr>
                                        <td colSpan="6" className="py-4 text-center text-gray-500">No SAR filings available</td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Compliance Metrics */}
            <div className="bg-white rounded-lg p-3 shadow-md mb-8">
                <h6 className="text-sm font-semibold text-gray-900 mb-3">Compliance Metrics</h6>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">SAR Filing Rate</p>
                        <p className="text-lg font-bold text-gray-900">98.5%</p>
                        <p className="text-xs text-green-600 mt-1">↑ 2.3%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Response Time</p>
                        <p className="text-lg font-bold text-gray-900">2.4 days</p>
                        <p className="text-xs text-green-600 mt-1">↓ 0.5 days</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Compliance Score</p>
                        <p className="text-lg font-bold text-gray-900">94.2%</p>
                        <p className="text-xs text-green-600 mt-1">↑ 1.8%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Active Investigations</p>
                        <p className="text-lg font-bold text-gray-900">12</p>
                        <p className="text-xs text-blue-600 mt-1">3 new this week</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RegulatorDashboard

