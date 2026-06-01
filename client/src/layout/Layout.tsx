import React, { useState } from 'react'
import '../layout/Layout.css'
import '../layout/Sidebar.css'
import '../layout/TopNavBar.css'
import type { AmlPageId } from './sections'
import { AML_SECTIONS } from './sections'
import { Sidebar } from './Sidebar'
import { IconRail } from './IconRail'
import { TopNavBar } from './TopNavBar'
import { Dashboard } from '../pages/Dashboard'
import { ActivityFeed } from '../pages/ActivityFeed'
import { Performance } from '../pages/Performance'
import { Customers } from '../pages/Customers'
import { KYC } from '../pages/KYC'
import { Screening } from '../pages/Screening'
import { ScreeningManual } from '../pages/ScreeningManual'
import { ScreeningApproved } from '../pages/ScreeningApproved'
import { ScreeningDeclined } from '../pages/ScreeningDeclined'
import { Transactions } from '../pages/Transactions'
import { TransactionsUpload } from '../pages/TransactionsUpload'
import { TransactionsUploadData } from '../pages/TransactionsUploadData'
import { Alerts } from '../pages/Alerts'
import { Cases } from '../pages/Cases'
import { SAR } from '../pages/SAR'
import { Modelling } from '../pages/Modelling'
import { Reports } from '../pages/Reports'
import { Configurations } from '../pages/Configurations'
import { DataManagement } from '../pages/DataManagement'
import { DataValidation } from '../pages/DataValidation'
import { ValidatedData } from '../pages/ValidatedData'
import { Notifications } from '../pages/Notifications'
import { useAuth } from '../contexts/AuthContext'
import { fetchJsonWithRetry, isAbortError } from '../contexts/fetchUtils'

type LayoutProps = {
  onLogout?: () => void
}

const ACTIVE_PAGE_STORAGE_KEY = 'aml_active_page'
const POST_LOGIN_PAGE_STORAGE_KEY = 'aml_post_login_page'
const NOTIFICATIONS_LAST_SEEN_STORAGE_KEY = 'aml_notifications_last_seen'
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'aml_notifications_dismissed_ids'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

type GenericRecord = Record<string, unknown>
type Paged<T> = { results?: T[] } | T[]

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const Layout: React.FC<LayoutProps> = ({ onLogout }) => {
  const { username, token } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [activePage, setActivePage] = useState<AmlPageId>(() => {
    const savedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY)
    if (savedPage) {
      const matchingPage = AML_SECTIONS.find((section) => section.id === savedPage)
      if (matchingPage) {
        window.sessionStorage.removeItem(POST_LOGIN_PAGE_STORAGE_KEY)
        return matchingPage.id
      }
    }

    const postLoginPage = window.sessionStorage.getItem(POST_LOGIN_PAGE_STORAGE_KEY)
    if (postLoginPage) {
      window.sessionStorage.removeItem(POST_LOGIN_PAGE_STORAGE_KEY)
      const matchingPostLoginPage = AML_SECTIONS.find((section) => section.id === postLoginPage)
      return matchingPostLoginPage?.id ?? 'dashboard'
    }

    return 'dashboard'
  })
  const [correctionDataset, setCorrectionDataset] = useState<string | null>(null)

  React.useEffect(() => {
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage)
  }, [activePage])

  const refreshUnreadNotifications = React.useCallback(async () => {
    const controller = new AbortController()
    try {
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Token ${token}`

      const payload = await fetchJsonWithRetry<Paged<GenericRecord>>(
        `${API_BASE_URL}/alerts/`,
        { headers, signal: controller.signal }
      )
      const alerts = rowsOf(payload)
      const dismissedRaw = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY)
      const dismissedIds = new Set<string>(
        dismissedRaw
          ? ((JSON.parse(dismissedRaw) as unknown[]).map((item) => String(item)))
          : []
      )

      const lastSeenRaw = window.localStorage.getItem(NOTIFICATIONS_LAST_SEEN_STORAGE_KEY)
      const lastSeenTime = lastSeenRaw ? Date.parse(lastSeenRaw) : 0

      const hasUnread = alerts.some((row) => {
        const id = String(row.id ?? '')
        if (dismissedIds.has(id)) return false
        const notificationTime = toDate(row.triggered_at ?? row.created_at)?.getTime()
        return typeof notificationTime === 'number' && notificationTime > lastSeenTime
      })
      setHasUnreadNotifications(hasUnread)
    } catch (error) {
      if (isAbortError(error)) return
      // Keep existing indicator state if refresh fails.
    } finally {
      controller.abort()
    }
  }, [token])

  React.useEffect(() => {
    void refreshUnreadNotifications()
    const intervalId = window.setInterval(() => {
      void refreshUnreadNotifications()
    }, 60000)
    return () => window.clearInterval(intervalId)
  }, [refreshUnreadNotifications])

  React.useEffect(() => {
    if (activePage !== 'notifications') return
    window.localStorage.setItem(NOTIFICATIONS_LAST_SEEN_STORAGE_KEY, new Date().toISOString())
    setHasUnreadNotifications(false)
  }, [activePage])

  const activeLabel = AML_SECTIONS.find((s) => s.id === activePage)?.label ?? ''
  const userInitials = (() => {
    if (!username || !username.trim()) return '?'
    const parts = username.trim().split(/[\s.@_-]+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  })()

  const renderContent = () => {
    if (activePage === 'dashboard') return <Dashboard />
    if (activePage === 'activity-feed') return <ActivityFeed />
    if (activePage === 'performance') return <Performance />
    if (activePage === 'customers') return <Customers />
    if (activePage === 'kyc') return <KYC />
    if (activePage === 'screening') return <Screening />
    if (activePage === 'screening-manual') return <ScreeningManual />
    if (activePage === 'screening-approved') return <ScreeningApproved />
    if (activePage === 'screening-declined') return <ScreeningDeclined />
    if (activePage === 'transactions') return <Transactions />
    if (activePage === 'transactions-upload') return <TransactionsUpload />
    if (activePage === 'transactions-upload-data') return <TransactionsUploadData />
    if (activePage === 'notifications') {
      return (
        <Notifications
          onClose={() => setActivePage('dashboard')}
          onOpenSettings={() => setActivePage('configurations-email')}
          onNotificationsChange={() => {
            void refreshUnreadNotifications()
          }}
        />
      )
    }
    if (activePage === 'alerts') return <Alerts />
    if (activePage === 'cases') return <Cases />
    if (activePage === 'sar') return <SAR />
    if (activePage === 'modelling') return <Modelling variant="use" />
    if (activePage === 'modelling-load') return <Modelling variant="load" />
    if (activePage === 'modelling-calibration') return <Modelling variant="calibration" />
    if (activePage === 'modelling-testing') return <Modelling variant="testing" />
    if (activePage === 'data-management') {
      return (
        <DataManagement
          onOpenDatasetForCorrection={(datasetName) => {
            setCorrectionDataset(datasetName)
            setActivePage('validated-data')
          }}
        />
      )
    }
    if (activePage === 'data-validation') return <DataValidation />
    if (activePage === 'validated-data') return <ValidatedData selectedDataset={correctionDataset} />
    if (activePage === 'reports') return <Reports variant="operational" />
    if (activePage === 'reports-sar') return <Reports variant="sar" />
    if (activePage === 'reports-exports') return <Reports variant="exports" />
    if (activePage === 'configurations') return <Configurations variant="system" />
    if (activePage === 'configurations-email') return <Configurations variant="email" />
    if (activePage === 'configurations-risk') return <Configurations variant="risk" />
    if (activePage === 'configurations-alert-rules') return <Configurations variant="alert-rules" />
    if (activePage === 'configurations-api') return <Configurations variant="api" />
    if (activeLabel === 'Upload Data') return <TransactionsUploadData />
    if (activeLabel === 'Batch Monitoring') return <TransactionsUpload />
    return <div className="placeholder-page">{activeLabel} — Coming soon</div>
  }

  return (
    <div className={`dashboard-container ${sidebarHidden ? 'sidebar-hidden' : ''} ${sidebarOpen ? 'menu-open' : ''}`}>
      <IconRail activeSection={activePage} onSelect={setActivePage} onLogout={onLogout} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} activePage={activePage} onSelect={setActivePage} />
      <main className="main-content">
        <TopNavBar
          onMenuClick={() => {
            if (sidebarOpen) {
              setSidebarOpen(false)
            } else {
              setSidebarOpen(true)
              setSidebarHidden(false)
            }
          }}
          activeSectionLabel={activeLabel}
          onSidebarToggle={() => setSidebarHidden((prev) => !prev)}
          isSidebarHidden={sidebarHidden}
          hasUnreadNotifications={hasUnreadNotifications}
          animateNotificationBell={hasUnreadNotifications && activePage !== 'notifications'}
          userInitials={userInitials}
          onNotificationsClick={() => setActivePage('notifications')}
          onLogout={onLogout}
        />
        <div className="main-content-scrollable">{renderContent()}</div>
      </main>
    </div>
  )
}




