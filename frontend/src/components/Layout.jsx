import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { base_url } from '../services/api'
import { useState, useEffect, useRef } from 'react'
import { logout, getCurrentUser, changePassword } from '../services/auth'
import logoMini from '../assets/img/logoipsum-351.png'
import logoFull from '../assets/img/logoipsum-350.png'
const Layout = ({ children }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [showPasswordSuccessPopup, setShowPasswordSuccessPopup] = useState(false)
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
    const [isLogoutConfirmModalOpen, setIsLogoutConfirmModalOpen] = useState(false)
    const userMenuRef = useRef(null)
    const notificationMenuRef = useRef(null)

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false)
            }
            if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
                setIsNotificationModalOpen(false)
            }
        }

        if (isUserMenuOpen || isNotificationModalOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isUserMenuOpen, isNotificationModalOpen])
    // Fetch unread alerts count (only NEW status alerts)
    const { data: unreadAlertsData } = useQuery({
        queryKey: ['unread-alerts-count'],
        queryFn: async () => {
            try {
                // Fetch all alerts and filter for NEW status
                const response = await axios.get(`${base_url}/alerts/`, {
                    params: {
                        status: 'NEW',
                        page_size: 10000
                    }
                })
                // Count all unread alerts (status = NEW)
                let count = 0
                if (response.data.results) {
                    // Filter to ensure only NEW status alerts are counted
                    count = response.data.results.filter(alert => alert.status === 'NEW').length
                } else if (Array.isArray(response.data)) {
                    count = response.data.filter(alert => alert.status === 'NEW').length
                }
                return count
            } catch (error) {
                return 0
            }
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    })

    const unreadCount = unreadAlertsData || 0

    // Fetch pending KYC verifications count (unverified customers)
    const { data: pendingKYCCountData } = useQuery({
        queryKey: ['pending-kyc-count'],
        queryFn: async () => {
            try {
                const response = await axios.get(`${base_url}/customers/`, {
                    params: {
                        kyc_verified: false,
                        page_size: 10000
                    }
                })
                // Count all unverified customers
                let count = 0
                if (response.data.results) {
                    count = response.data.results.filter(customer => !customer.kyc_verified).length
                } else if (Array.isArray(response.data)) {
                    count = response.data.filter(customer => !customer.kyc_verified).length
                }
                return count
            } catch (error) {
                return 0
            }
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    })

    const pendingKYCCount = pendingKYCCountData || 0

    // Fetch recent alerts for notification modal
    const { data: recentAlertsData, isLoading: isLoadingAlerts } = useQuery({
        queryKey: ['recent-alerts'],
        queryFn: async () => {
            try {
                const response = await axios.get(`${base_url}/alerts/`, {
                    params: {
                        page_size: 10,
                        ordering: '-created_at'
                    }
                })
                return response.data.results || response.data || []
            } catch (error) {
                return []
            }
        },
        enabled: isNotificationModalOpen, // Only fetch when modal is open
        refetchInterval: isNotificationModalOpen ? 30000 : false, // Refetch every 30 seconds when open
    })

    const recentAlerts = recentAlertsData || []

    const getSeverityBadgeClass = (severity) => {
        switch (severity) {
            case 'CRITICAL':
                return 'bg-red-100 text-red-700'
            case 'HIGH':
                return 'bg-orange-100 text-orange-700'
            case 'MEDIUM':
                return 'bg-yellow-100 text-yellow-700'
            case 'LOW':
                return 'bg-green-100 text-green-700'
            default:
                return 'bg-gray-100 text-gray-700'
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
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    // Fetch current user information
    const { data: currentUser, error: userError } = useQuery({
        queryKey: ['current-user'],
        queryFn: getCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })

    // Log user error for debugging
    if (userError) {
        console.error('Error fetching current user:', userError)
    }

    // Get user display name and email
    const userName = currentUser?.username || currentUser?.first_name || currentUser?.name || 'User'
    const userEmail = currentUser?.email || 'user@example.com'
    const userDisplayName = currentUser?.first_name && currentUser?.last_name
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : currentUser?.username || currentUser?.name || 'User Name'

    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/'
        }
        return location.pathname.includes(path)
    }

    return (
        <div className="bg-gray-50 text-xs antialiased overflow-hidden" style={{ fontFamily: "'Nunito', sans-serif" }}>
            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            {/* Main Content */}
            <div className="lg:ml-64 h-screen bg-gray-200 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div
                    className="bg-white px-8 border-b border-gray-200 flex items-center justify-between flex-shrink-0 h-16 relative"
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
                >
                    {/* Mobile Menu Toggle */}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-black/90 hover:bg-gray-50 hover:scale-105 hover:shadow-lg hover:text-black/100 text-sm px-4 py-2 lg:hidden rounded-lg transition-all duration-200">
                        <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </button>

                    {/* Logo - Centered */}
                    <div className="mx-auto lg:mx-0">
                        <img
                            src={logoFull}
                            alt="Logo"
                            className="h-10 lg:h-12 w-auto object-contain"
                        />
                    </div>

                    {/* Notification Icon and User Dropdown Menu */}
                    <div className="flex items-center space-x-3">
                        {/* Notification Icon */}
                        <div className="relative" ref={notificationMenuRef}>
                            <button
                                onClick={() => setIsNotificationModalOpen(!isNotificationModalOpen)}
                                className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all duration-200 focus:outline-none"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* User Dropdown Menu */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none transition-all duration-200"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-md hover:shadow-lg hover:bg-blue-700 transition-all duration-200">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                </div>
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                    <div className="px-4 py-2 border-b border-gray-200">
                                        <p className="text-sm font-medium text-gray-900">{userDisplayName}</p>
                                        <p className="text-xs text-gray-500">{userEmail}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsUserMenuOpen(false)
                                            setIsProfileModalOpen(true)
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsUserMenuOpen(false)
                                            setIsSettingsModalOpen(true)
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Settings
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsUserMenuOpen(false)
                                            setIsLogoutConfirmModalOpen(true)
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="px-4 pb-4 pt-6 flex flex-col flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>

            {/* Sidebar */}
            <div
                id="sidebar"
                className={`fixed top-0 left-0 h-screen shadow-xl w-64 overflow-y-auto z-50 bg-[#1E3A5F] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } lg:translate-x-0`}
            // style={{ backgroundColor: '#011325' }}
            >
                <div className="px-5 py-2 bg-white text-lg text-black h-16 text-left flex gap-4 items-center justify-between border-b border-white/10 mb-3">
                    <img
                        src={logoMini}
                        alt="Logo"
                        className="h-10 w-auto object-contain"
                    />
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden text-black hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <nav className="flex flex-col px-3 py-2">
                    {/* 1. Overview */}
                    <Link
                        to="/"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('/') && location.pathname === '/' ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        Dashboard
                    </Link>

                    {/* 2. Customer Onboarding */}
                    <Link
                        to="/customers"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('customer') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        Customers
                    </Link>

                    {/* 3. KYC Verification */}
                    <Link
                        to="/kyc"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 relative ${isActive('kyc') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                        </svg>
                        KYC Verification
                        {pendingKYCCount > 0 && (
                            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                                {pendingKYCCount > 99 ? '99+' : pendingKYCCount}
                            </span>
                        )}
                    </Link>

                    {/* 4. Watchlist Screening */}
                    <Link
                        to="/screening"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('screening') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        Screening
                    </Link>

                    {/* 5. Transaction Monitoring */}
                    <Link
                        to="/transactions"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('transaction') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Transactions
                    </Link>

                    {/* 6. Alert Management */}
                    <Link
                        to="/alerts"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 relative ${isActive('alert') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Alerts
                        {unreadCount > 0 && (
                            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </Link>

                    {/* 7. Case Management */}
                    <Link
                        to="/cases"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('case') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                        </svg>
                        Cases
                    </Link>

                    {/* 8. SAR Filing */}
                    <Link
                        to="/sar"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('sar') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        SAR Filing
                    </Link>

                    {/* 10. Law Enforcement */}
                    <Link
                        to="/law-enforcement"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('law-enforcement') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        </svg>
                        Law Enforcement
                    </Link>

                    {/* 11. ML Models (Supporting) */}
                    <Link
                        to="/ml"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('ml') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                        </svg>
                        ML Models
                    </Link>

                    {/* 12. Reports (Supporting) */}
                    <Link
                        to="/reports"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('report') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                        </svg>
                        Reports
                    </Link>

                    {/* 13. Configurations */}
                    <Link
                        to="/configurations"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('configuration') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        Configurations
                    </Link>
                </nav>
            </div>

            {/* Profile Modal */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">User Profile</h3>
                            <button
                                onClick={() => setIsProfileModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Profile Header */}
                            <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
                                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900">{userDisplayName}</h4>
                                    <p className="text-sm text-gray-500">{userEmail}</p>
                                    <div className="flex items-center space-x-2 mt-2">
                                        {currentUser?.is_staff && (
                                            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                                Staff
                                            </span>
                                        )}
                                        {currentUser?.is_superuser && (
                                            <span className="inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                                                Administrator
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* User Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Username */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-900">
                                        {currentUser?.username || 'N/A'}
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-900">
                                        {currentUser?.email || 'N/A'}
                                    </div>
                                </div>

                                {/* First Name */}
                                {currentUser?.first_name && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                        <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-900">
                                            {currentUser.first_name}
                                        </div>
                                    </div>
                                )}

                                {/* Last Name */}
                                {currentUser?.last_name && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                        <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-900">
                                            {currentUser.last_name}
                                        </div>
                                    </div>
                                )}

                                {/* User ID */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-900">
                                        {currentUser?.id || 'N/A'}
                                    </div>
                                </div>

                                {/* Account Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-900">
                                        {currentUser?.is_superuser ? 'Administrator' : currentUser?.is_staff ? 'Staff' : 'User'}
                                    </div>
                                </div>
                            </div>

                            {/* Loading State */}
                            {!currentUser && !userError && (
                                <div className="text-center py-8">
                                    <div className="text-gray-500">Loading user information...</div>
                                </div>
                            )}

                            {/* Error State */}
                            {userError && (
                                <div className="text-center py-8">
                                    <div className="text-red-500">Error loading user information</div>
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsProfileModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Account Settings Section */}
                            <div>
                                <h4 className="text-base font-semibold text-gray-900 mb-4">Account Settings</h4>
                                <div className="space-y-4">
                                    {/* Notification Preferences */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Notification Preferences</label>
                                        <div className="space-y-2">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    defaultChecked
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">Email notifications</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    defaultChecked
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">Alert notifications</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">System updates</span>
                                            </label>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Security Settings Section */}
                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="text-base font-semibold text-gray-900 mb-4">Security</h4>
                                <div className="space-y-4">
                                    {/* Change Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Change Password</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsSettingsModalOpen(false)
                                                setIsChangePasswordModalOpen(true)
                                            }}
                                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                                        >
                                            Change Password
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {isChangePasswordModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
                            <button
                                onClick={() => {
                                    setIsChangePasswordModalOpen(false)
                                    setPasswordData({
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmPassword: ''
                                    })
                                    setPasswordError('')
                                    setPasswordSuccess('')
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
                            {passwordError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                    {passwordError}
                                </div>
                            )}

                            {/* Current Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your current password"
                                />
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your new password"
                                />
                            </div>

                            {/* Confirm New Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Confirm your new password"
                                />
                            </div>

                            {/* Password Requirements */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <p className="text-xs text-blue-800 font-semibold mb-2">Password Requirements:</p>
                                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                    <li>At least 8 characters long</li>
                                    <li>Contains at least one uppercase letter</li>
                                    <li>Contains at least one lowercase letter</li>
                                    <li>Contains at least one number</li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-end space-x-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsChangePasswordModalOpen(false)
                                    setPasswordData({
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmPassword: ''
                                    })
                                    setPasswordError('')
                                    setPasswordSuccess('')
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isChangingPassword}
                                onClick={async () => {
                                    setPasswordError('')
                                    setPasswordSuccess('')

                                    // Validate passwords
                                    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
                                        setPasswordError('All fields are required')
                                        return
                                    }
                                    if (passwordData.newPassword !== passwordData.confirmPassword) {
                                        setPasswordError('New passwords do not match')
                                        return
                                    }
                                    if (passwordData.newPassword.length < 8) {
                                        setPasswordError('New password must be at least 8 characters long')
                                        return
                                    }

                                    setIsChangingPassword(true)

                                    try {
                                        await changePassword(passwordData.currentPassword, passwordData.newPassword)

                                        // Close modal and show success popup
                                        setIsChangePasswordModalOpen(false)
                                        setPasswordData({
                                            currentPassword: '',
                                            newPassword: '',
                                            confirmPassword: ''
                                        })
                                        setPasswordError('')
                                        setPasswordSuccess('')

                                        // Show success popup
                                        setShowPasswordSuccessPopup(true)
                                        setTimeout(() => {
                                            setShowPasswordSuccessPopup(false)
                                        }, 3000)
                                    } catch (error) {
                                        if (error.response?.status === 400) {
                                            setPasswordError(error.response?.data?.error || 'Failed to change password. Please check your current password.')
                                        } else if (error.response?.status === 401) {
                                            setPasswordError('Authentication required. Please log in again.')
                                        } else {
                                            setPasswordError(error.response?.data?.error || error.message || 'An error occurred while changing password')
                                        }
                                    } finally {
                                        setIsChangingPassword(false)
                                    }
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isChangingPassword ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Success Popup */}
            {showPasswordSuccessPopup && (
                <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-5">
                    <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <div>
                            <p className="font-semibold">Password Changed</p>
                            <p className="text-sm text-green-100">Your password has been successfully updated.</p>
                        </div>
                        <button
                            onClick={() => setShowPasswordSuccessPopup(false)}
                            className="ml-auto text-white hover:text-green-100"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            {isNotificationModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={() => setIsNotificationModalOpen(false)}
                >
                    <div
                        className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center space-x-2">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                </svg>
                                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setIsNotificationModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {isLoadingAlerts ? (
                                <div className="text-center py-8">
                                    <div className="text-gray-500">Loading notifications...</div>
                                </div>
                            ) : recentAlerts.length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                    </svg>
                                    <p className="text-gray-500">No notifications</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentAlerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            onClick={() => {
                                                setIsNotificationModalOpen(false)
                                                navigate('/alerts')
                                            }}
                                            className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${alert.status === 'NEW' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {alert.alert_type || 'Alert'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityBadgeClass(alert.severity)}`}>
                                                            {alert.severity || 'MEDIUM'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(alert.status)}`}>
                                                            {alert.status || 'NEW'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-1">
                                                        {alert.customer_name || alert.customer_id || 'Unknown Customer'}
                                                    </p>
                                                    {alert.alert_id && (
                                                        <p className="text-xs text-gray-500 font-mono">
                                                            ID: {alert.alert_id}
                                                        </p>
                                                    )}
                                                    {alert.created_at && (
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {new Date(alert.created_at).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                                {alert.status === 'NEW' && (
                                                    <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1"></div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer - Static */}
                        <div className="bg-white border-t border-gray-200 shadow px-6 py-3 flex justify-between items-center flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsNotificationModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNotificationModalOpen(false)
                                    navigate('/alerts')
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                            >
                                View All Alerts
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {isLogoutConfirmModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={() => setIsLogoutConfirmModalOpen(false)}
                >
                    <div
                        className="bg-white shadow-xl w-full max-w-md m-4 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
                            <h3 className="text-lg font-semibold text-gray-900">Confirm Logout</h3>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            <p className="text-sm text-gray-700">
                                Are you sure you want to logout?
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setIsLogoutConfirmModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    setIsLogoutConfirmModalOpen(false)
                                    await logout()
                                    navigate('/login')
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

export default Layout
