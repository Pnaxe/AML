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
    const [showSettingsSavedNotification, setShowSettingsSavedNotification] = useState(false)
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
    const userRole = currentUser?.role || 'VIEWER'

    // Check if user is regulator (regulators only see Dashboard, SAR, Law Enforcement, Reports)
    const isRegulator = userRole === 'REGULATOR'
    // Check if user is bank user (bank users see all pages)
    const isBankUser = userRole === 'BANK'

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
                        {isRegulator ? (
                            <svg width="138" height="36" viewBox="0 0 138 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-10 lg:h-12 w-auto">
                                <path d="M11.3078 32.6547L8.05536 27.0213L12.8285 18.7767L15.8616 24.0306L33.7668 24.021L28.6861 32.7325L11.3078 32.6547Z" className="ccompli2" fill="#FFAD64"></path>
                                <path d="M36.9641 18.4272L33.7117 24.0605L24.1851 24.0493L27.2185 18.7955L18.2576 3.29395L28.3423 3.3382L36.9641 18.4272Z" className="ccompli1" fill="#ADD4D3"></path>
                                <path d="M11.8091 3.26395H18.314L23.0675 11.52L17.0008 11.5197L8.05663 27.0309L3.05255 18.2752L11.8091 3.26395Z" className="ccustom" fill="#FB8351"></path>
                                <path fillRule="evenodd" clipRule="evenodd" d="M19.107 1.95961L19.0876 1.92596H11.0406L1.50755 18.2684L8.05149 29.7184L8.05952 29.7045L10.5334 33.9894L29.4528 34.074L36.0969 22.6817H36.0527L38.5071 18.4306L29.1207 2.00354L19.107 1.95961ZM25.3318 12.858H25.382L20.6517 4.64252L27.5638 4.67283L35.421 18.4237L32.9617 22.6835L26.5167 22.6869L28.7638 18.795L25.3318 12.858ZM17.4683 4.60202L20.6937 10.1818L16.2279 10.1817L8.58236 23.4406L8.06084 24.3415L4.59771 18.282L12.5777 4.60202H17.4683ZM14.3672 18.7656L17.7738 12.8578L22.2408 12.858L25.6732 18.7958L23.4256 22.6886L16.6341 22.6923L14.3672 18.7656ZM9.60358 27.0267L10.8996 24.7792L12.8269 21.4501L15.0894 25.3692L21.8799 25.3655L21.8689 25.3845L31.4161 25.3958L27.9196 31.3911L12.0824 31.3202L9.60358 27.0267Z" className="cneutral" fill="#333237"></path>
                                <path d="M87.2459 11.7188C88.1623 11.7188 88.9068 10.9742 88.9068 10.0388C88.9068 9.10333 88.1623 8.37788 87.2459 8.37788C86.3105 8.37788 85.5659 9.10333 85.5659 10.0388C85.5659 10.9742 86.3105 11.7188 87.2459 11.7188ZM85.7568 22.7533H88.7159V13.2079H85.7568V22.7533Z" className="ccustom" fill="#FB8351"></path>
                                <path d="M90.4384 27.3352H93.3403V21.7988C93.8939 22.5243 95.1539 23.0206 96.4712 23.0206C99.3157 23.0206 101.034 20.8443 100.958 17.8279C100.881 14.7542 99.1057 12.9024 96.4521 12.9024C95.0966 12.9024 93.8175 13.4942 93.283 14.3724L93.1303 13.2079H90.4384V27.3352ZM93.3975 17.9806C93.3975 16.5488 94.3521 15.5943 95.7266 15.5943C97.1203 15.5943 97.9985 16.5679 97.9985 17.9806C97.9985 19.3933 97.1203 20.367 95.7266 20.367C94.3521 20.367 93.3975 19.4124 93.3975 17.9806Z" className="ccustom" fill="#FB8351"></path>
                                <path d="M101.271 19.737C101.347 21.6652 102.875 23.0015 105.28 23.0015C107.59 23.0015 109.194 21.7797 109.194 19.8133C109.194 18.4006 108.354 17.4652 106.788 17.0833L105.089 16.6633C104.478 16.5106 104.096 16.3579 104.096 15.8615C104.096 15.3652 104.497 15.0406 105.089 15.0406C105.757 15.0406 106.196 15.4797 106.177 16.1288H108.831C108.755 14.1433 107.246 12.9024 105.146 12.9024C103.027 12.9024 101.443 14.1624 101.443 16.0715C101.443 17.3506 102.149 18.4006 104.039 18.897L105.719 19.3361C106.215 19.4697 106.425 19.6988 106.425 20.0233C106.425 20.5006 105.986 20.8061 105.242 20.8061C104.383 20.8061 103.925 20.4052 103.925 19.737H101.271Z" className="ccustom" fill="#FB8351"></path>
                                <path d="M113.694 23.0015C114.858 23.0015 116.023 22.467 116.615 21.6843L116.806 22.7533H119.574V13.2079H116.634V18.1715C116.634 19.6033 116.214 20.3861 114.858 20.3861C113.808 20.3861 113.121 19.9088 113.121 18.1333V13.2079H110.181V19.2024C110.181 21.4743 111.441 23.0015 113.694 23.0015Z" className="ccustom" fill="#FB8351"></path>
                                <path d="M124.236 22.7533V17.5415C124.236 15.9379 125.095 15.4797 125.935 15.4797C126.871 15.4797 127.482 16.0524 127.482 17.2361V22.7533H130.383V17.5415C130.383 15.9188 131.223 15.4606 132.063 15.4606C132.999 15.4606 133.629 16.0333 133.629 17.2361V22.7533H136.492V16.5106C136.492 14.3342 135.347 12.8833 132.884 12.8833C131.51 12.8833 130.383 13.5515 129.887 14.5824C129.314 13.5515 128.322 12.8833 126.737 12.8833C125.687 12.8833 124.713 13.3606 124.141 14.1242L124.026 13.2079H121.277V22.7533H124.236Z" className="ccustom" fill="#FB8351"></path>
                                <path d="M46.9241 8.62749H43.7932V22.7548H52.4605V19.9866H46.9241V8.62749Z" className="cneutral" fill="#333237"></path>
                                <path d="M52.7595 17.963C52.7595 20.9793 54.7832 22.9839 57.8377 22.9839C60.8732 22.9839 62.8968 20.9793 62.8968 17.963C62.8968 14.9466 60.8732 12.9229 57.8377 12.9229C54.7832 12.9229 52.7595 14.9466 52.7595 17.963ZM55.7186 17.9439C55.7186 16.512 56.5586 15.5575 57.8377 15.5575C59.0977 15.5575 59.9377 16.512 59.9377 17.9439C59.9377 19.3948 59.0977 20.3493 57.8377 20.3493C56.5586 20.3493 55.7186 19.3948 55.7186 17.9439Z" className="cneutral" fill="#333237"></path>
                                <path d="M63.3697 17.8102C63.3697 20.693 65.2407 22.6402 67.8943 22.6402C69.1734 22.6402 70.2807 22.1821 70.8343 21.4375V22.7548C70.8343 24.0721 70.0134 24.9502 68.5625 24.9502C67.2643 24.9502 66.367 24.3393 66.3097 23.2511H63.3316C63.5988 25.8666 65.6225 27.623 68.3907 27.623C71.6552 27.623 73.717 25.5039 73.717 22.1439V13.2093H71.0634L70.9107 14.183C70.3761 13.4002 69.2498 12.8848 67.9516 12.8848C65.2788 12.8848 63.3697 14.8893 63.3697 17.8102ZM66.3479 17.7339C66.3479 16.3593 67.2643 15.443 68.4288 15.443C69.7843 15.443 70.777 16.3402 70.777 17.7339C70.777 19.1275 69.8034 20.082 68.4479 20.082C67.2834 20.082 66.3479 19.1275 66.3479 17.7339Z" className="cneutral" fill="#333237"></path>
                                <path d="M74.5739 17.963C74.5739 20.9793 76.5975 22.9839 79.6521 22.9839C82.6875 22.9839 84.7112 20.9793 84.7112 17.963C84.7112 14.9466 82.6875 12.9229 79.6521 12.9229C76.5975 12.9229 74.5739 14.9466 74.5739 17.963ZM77.533 17.9439C77.533 16.512 78.373 15.5575 79.6521 15.5575C80.9121 15.5575 81.7521 16.512 81.7521 17.9439C81.7521 19.3948 80.9121 20.3493 79.6521 20.3493C78.373 20.3493 77.533 19.3948 77.533 17.9439Z" className="cneutral" fill="#333237"></path>
                            </svg>
                        ) : (
                            <img
                                src={logoFull}
                                alt="Logo"
                                className="h-10 lg:h-12 w-auto object-contain"
                            />
                        )}
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

                    {/* 2. Customer Onboarding - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

                    {/* 3. KYC Verification - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

                    {/* 4. Watchlist Screening - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

                    {/* 5. Transaction Monitoring - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

                    {/* 6. Alert Management - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

                    {/* 7. Case Management - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

                    {/* 8. SAR */}
                    <Link
                        to="/sar"
                        className={`text-white/80 hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:text-white text-sm px-4 py-2 mb-2 rounded-lg transition-all duration-200 ${isActive('sar') ? 'bg-blue-600 text-white' : ''
                            }`}
                    >
                        <svg className="w-5 h-5 inline-block mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        SAR
                    </Link>

                    {/* 10. Law Enforcement - Only for Regulators */}
                    {isRegulator && (
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
                    )}

                    {/* 11. ML Models (Supporting) - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}

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

                    {/* 13. Configurations - Hidden for Regulators */}
                    {!isRegulator && (
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
                    )}
                </nav>
            </div>

            {/* Profile Modal */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white shadow-xl w-full max-w-2xl max-h-[70vh] m-4 flex flex-col">
                        {/* Header - Static */}
                        <div className="bg-white border-b border-gray-200 shadow px-6 py-4 flex items-center justify-between flex-shrink-0">
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
                            {/* User Information Section */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">User Information</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="font-medium text-gray-600">Username:</span>
                                        <p className="text-gray-900">{currentUser?.username || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Email:</span>
                                        <p className="text-gray-900">{currentUser?.email || 'N/A'}</p>
                                    </div>
                                    {currentUser?.first_name && (
                                        <div>
                                            <span className="font-medium text-gray-600">First Name:</span>
                                            <p className="text-gray-900">{currentUser.first_name}</p>
                                        </div>
                                    )}
                                    {currentUser?.last_name && (
                                        <div>
                                            <span className="font-medium text-gray-600">Last Name:</span>
                                            <p className="text-gray-900">{currentUser.last_name}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-medium text-gray-600">User ID:</span>
                                        <p className="text-gray-900 font-mono">{currentUser?.id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Role:</span>
                                        <p className="text-gray-900">{currentUser?.role || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Account Type:</span>
                                        <p className="text-gray-900">{currentUser?.is_superuser ? 'Administrator' : currentUser?.is_staff ? 'Staff' : 'User'}</p>
                                    </div>
                                    {currentUser?.department && (
                                        <div>
                                            <span className="font-medium text-gray-600">Department:</span>
                                            <p className="text-gray-900">{currentUser.department}</p>
                                        </div>
                                    )}
                                    {currentUser?.phone_number && (
                                        <div>
                                            <span className="font-medium text-gray-600">Phone Number:</span>
                                            <p className="text-gray-900">{currentUser.phone_number}</p>
                                        </div>
                                    )}
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
                        <div className="bg-white border-t border-gray-200 shadow px-3 py-2 flex justify-end space-x-3 flex-shrink-0" style={{
                            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
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
                                onClick={() => {
                                    setIsSettingsModalOpen(false)
                                    // Show success notification
                                    setShowSettingsSavedNotification(true)
                                    setTimeout(() => {
                                        setShowSettingsSavedNotification(false)
                                    }, 3000)
                                }}
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

            {/* Settings Saved Notification */}
            {showSettingsSavedNotification && (
                <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-5">
                    <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <div>
                            <p className="font-semibold">Changes Saved</p>
                            <p className="text-sm text-green-100">Your settings have been successfully saved.</p>
                        </div>
                        <button
                            onClick={() => setShowSettingsSavedNotification(false)}
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
