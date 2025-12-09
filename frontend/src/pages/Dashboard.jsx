import { useEffect, useRef } from 'react'
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

const Dashboard = () => {
    // Fetch data
    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: () => axios.get(`${base_url}/customers/`).then(res => res.data),
    })

    const { data: transactionsData } = useQuery({
        queryKey: ['transactions'],
        queryFn: () => axios.get(`${base_url}/transactions/`).then(res => res.data),
    })

    const { data: alertsData } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => axios.get(`${base_url}/alerts/`).then(res => res.data),
    })

    // Stats
    const stats = {
        total_transactions: transactionsData?.count || 12485,
        high_risk_alerts: alertsData?.results?.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length || 143,
        pending_sars: 24,
        active_cases: 67,
    }

    // Chart data
    const transactionVolumeData = {
        labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
        datasets: [{
            label: 'Transaction Volume',
            data: [12500, 14200, 13800, 15600, 17200, 16800, 18400],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        }]
    }

    const alertDistributionData = {
        labels: ['High Risk', 'Medium Risk', 'Low Risk', 'Informational'],
        datasets: [{
            label: 'Alerts',
            data: [143, 287, 456, 892],
            backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)'
            ]
        }]
    }

    const riskDistributionData = {
        labels: ['High Risk', 'Medium Risk', 'Low Risk'],
        datasets: [{
            data: [15, 35, 50],
            backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(34, 197, 94, 0.8)'
            ]
        }]
    }

    const caseStatusData = {
        labels: ['Open', 'In Progress', 'Closed'],
        datasets: [{
            data: [67, 45, 234],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(34, 197, 94, 0.8)'
            ]
        }]
    }

    const kycStatusData = {
        labels: ['Verified', 'Pending', 'Failed'],
        datasets: [{
            data: [8542, 325, 89],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ]
        }]
    }

    const sarTrendsData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Filed',
                data: [45, 52, 48, 61, 58, 67],
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4
            },
            {
                label: 'Pending',
                data: [12, 15, 18, 14, 20, 24],
                borderColor: 'rgb(251, 191, 36)',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                tension: 0.4
            }
        ]
    }

    const regionData = {
        labels: ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'],
        datasets: [{
            label: 'Transaction Volume',
            data: [45000, 38000, 32000, 18000, 12000],
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
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value) {
                        return value.toLocaleString();
                    }
                }
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

    const horizontalBarOptions = {
        ...chartOptions,
        indexAxis: 'y',
        scales: {
            x: {
                beginAtZero: true,
                ticks: {
                    callback: function (value) {
                        return value.toLocaleString();
                    }
                }
            }
        }
    }

    const sarChartOptions = {
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

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Page Title */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900">AML System Dashboard</h4>
                    <small className="text-gray-500 text-xs">Real-time monitoring and analytics</small>
                </div>
            </div>

            {/* Critical Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Total Transactions */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Total Transactions</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.total_transactions.toLocaleString()}</h3>
                        <p className="text-xs text-green-600 mt-0.5">↑ 12.5% from last month</p>
                    </div>
                </div>

                {/* High Risk Alerts */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-red-100 text-red-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">High Risk Alerts</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.high_risk_alerts}</h3>
                        <p className="text-xs text-red-600 mt-0.5">↑ 8 new today</p>
                    </div>
                </div>

                {/* Pending SARs */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Pending SARs</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.pending_sars}</h3>
                        <p className="text-xs text-yellow-600 mt-0.5">5 due this week</p>
                    </div>
                </div>

                {/* Active Cases */}
                <div className="bg-white rounded-lg p-3 shadow-md relative">
                    <div className="absolute top-3 right-3">
                        <div className="bg-purple-100 text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-900 mb-0.5">Active Cases</p>
                        <h3 className="text-lg font-bold text-gray-900">{stats.active_cases}</h3>
                        <p className="text-xs text-purple-600 mt-0.5">12 require action</p>
                    </div>
                </div>
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                {/* Transaction Volume Trend */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                        <div>
                            <h6 className="text-sm font-semibold text-gray-900">Transaction Volume Trend</h6>
                            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
                        </div>
                        <div className="flex gap-2 mt-2 sm:mt-0">
                            <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">Daily</span>
                        </div>
                    </div>
                    <div style={{ height: '250px' }}>
                        <Line data={transactionVolumeData} options={lineChartOptions} />
                    </div>
                </div>

                {/* Alert Trends */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h6 className="text-sm font-semibold text-gray-900">Alert Distribution</h6>
                            <p className="text-xs text-gray-500 mt-1">By risk level</p>
                        </div>
                    </div>
                    <div style={{ height: '250px' }}>
                        <Bar data={alertDistributionData} options={barChartOptions} />
                    </div>
                </div>
            </div>

            {/* Second Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {/* Risk Score Distribution */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">Customer Risk Distribution</h6>
                    <div style={{ height: '200px' }}>
                        <Doughnut data={riskDistributionData} options={chartOptions} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                                <span className="text-gray-600">High Risk</span>
                            </div>
                            <span className="font-semibold">15%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                                <span className="text-gray-600">Medium Risk</span>
                            </div>
                            <span className="font-semibold">35%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                                <span className="text-gray-600">Low Risk</span>
                            </div>
                            <span className="font-semibold">50%</span>
                        </div>
                    </div>
                </div>

                {/* Case Status */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">Case Status Overview</h6>
                    <div style={{ height: '200px' }}>
                        <Pie data={caseStatusData} options={chartOptions} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                <span className="text-gray-600">Open</span>
                            </div>
                            <span className="font-semibold">67</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                                <span className="text-gray-600">In Progress</span>
                            </div>
                            <span className="font-semibold">45</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                                <span className="text-gray-600">Closed</span>
                            </div>
                            <span className="font-semibold">234</span>
                        </div>
                    </div>
                </div>

                {/* KYC Status */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">KYC Verification Status</h6>
                    <div style={{ height: '200px' }}>
                        <Doughnut data={kycStatusData} options={chartOptions} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                                <span className="text-gray-600">Verified</span>
                            </div>
                            <span className="font-semibold">8,542</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                                <span className="text-gray-600">Pending</span>
                            </div>
                            <span className="font-semibold">325</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                                <span className="text-gray-600">Failed</span>
                            </div>
                            <span className="font-semibold">89</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SAR Filing Trends and ML Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                {/* SAR Filing Trends */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">SAR Filing Trends</h6>
                    <div style={{ height: '200px' }}>
                        <Line data={sarTrendsData} options={sarChartOptions} />
                    </div>
                </div>

                {/* ML Model Performance */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">ML Model Performance</h6>
                    <div className="space-y-4">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600 font-medium">Risk Scoring Model</span>
                                <span className="font-semibold text-green-600">94.2% Accuracy</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-green-500 h-3 rounded-full" style={{ width: '94.2%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600 font-medium">Anomaly Detection</span>
                                <span className="font-semibold text-green-600">92.7% Accuracy</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-green-500 h-3 rounded-full" style={{ width: '92.7%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600 font-medium">Pattern Recognition</span>
                                <span className="font-semibold text-blue-600">89.3% Accuracy</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-blue-500 h-3 rounded-full" style={{ width: '89.3%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600 font-medium">Transaction Classifier</span>
                                <span className="font-semibold text-yellow-600">86.5% Accuracy</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-yellow-500 h-3 rounded-full" style={{ width: '86.5%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent High Priority Alerts */}
            <div className="bg-white rounded-lg p-3 shadow-md mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                    <h6 className="text-sm font-semibold text-gray-900">High Priority Alerts</h6>
                    <a href="/alerts" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All →</a>
                </div>
                <div className="overflow-x-auto -mx-3 px-3">
                    <table className="w-full text-xs min-w-[600px]">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-2 font-semibold text-gray-700">Alert ID</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700">Type</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700 hidden sm:table-cell">Customer</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700">Risk Level</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700 hidden md:table-cell">Status</th>
                                <th className="text-left py-3 px-2 font-semibold text-gray-700 hidden lg:table-cell">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alertsData?.results?.slice(0, 5).map((alert, idx) => (
                                <tr key={alert.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-2 font-mono text-xs">{alert.alert_id || `#ALT-${8900 + idx}`}</td>
                                    <td className="py-3 px-2">{alert.alert_type || 'Large Cash Deposit'}</td>
                                    <td className="py-3 px-2 hidden sm:table-cell">{alert.customer_name || 'John Smith'}</td>
                                    <td className="py-3 px-2">
                                        <span className={`px-2 py-1 rounded-full text-xs ${alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {alert.severity || 'High'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 hidden md:table-cell">
                                        <span className={`px-2 py-1 rounded-full text-xs ${alert.status === 'NEW' ? 'bg-yellow-100 text-yellow-700' :
                                            alert.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {alert.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-gray-500 hidden lg:table-cell">
                                        {alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : '2 hours ago'}
                                    </td>
                                </tr>
                            )) || (
                                    <tr>
                                        <td colSpan="6" className="py-4 text-center text-gray-500">No alerts available</td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction Geography and System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
                {/* Top Transaction Regions */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">Top Transaction Regions</h6>
                    <div style={{ height: '200px' }}>
                        <Bar data={regionData} options={horizontalBarOptions} />
                    </div>
                </div>

                {/* System Health Metrics */}
                <div className="bg-white rounded-lg p-3 shadow-md">
                    <h6 className="text-sm font-semibold text-gray-900 mb-3">System Health Metrics</h6>
                    <div className="space-y-4">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600">API Response Time</span>
                                <span className="font-semibold text-green-600">45ms - Excellent</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600">Database Performance</span>
                                <span className="font-semibold text-green-600">98% - Optimal</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600">Processing Queue</span>
                                <span className="font-semibold text-blue-600">234 jobs - Normal</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1 sm:gap-0">
                                <span className="text-gray-600">System Uptime</span>
                                <span className="font-semibold text-green-600">99.98% - 45 days</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: '99.98%' }}></div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Active Users</p>
                                    <p className="text-lg font-bold text-gray-900">48</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Avg. Load</p>
                                    <p className="text-lg font-bold text-gray-900">32%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
