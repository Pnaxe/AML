import React from 'react'
import ReactDOM from 'react-dom/client'
import './app.css'
import './layout/Layout.css'
import { Layout } from './layout/Layout'
import { Logo } from './layout/Logo'
import { Login } from './pages/Login'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { UnreadCountProvider } from './contexts/UnreadCountContext'
import { ToastProvider } from './contexts/ToastContext'

const LOGIN_ROUTE = '/login'
const OVERVIEW_ROUTE = '/overview'

function normalizePathname(pathname: string) {
  const normalizedPath = pathname.toLowerCase()
  if (normalizedPath === '/' || normalizedPath === '') return LOGIN_ROUTE
  return normalizedPath
}

function getAppRoute(pathname: string) {
  const normalizedPath = normalizePathname(pathname)
  if (normalizedPath === OVERVIEW_ROUTE) return 'overview'
  return 'login'
}

function syncRoute(pathname: string) {
  if (normalizePathname(window.location.pathname) === pathname) return
  window.history.replaceState(null, '', pathname)
}

function App() {
  const { isAuthenticated, isLoadingAuth, logout } = useAuth()
  const [route, setRoute] = React.useState(() => getAppRoute(window.location.pathname))

  React.useEffect(() => {
    if (window.location.hash === '#/login') {
      window.history.replaceState(null, '', LOGIN_ROUTE)
    } else if (window.location.hash === '#/overview') {
      window.history.replaceState(null, '', OVERVIEW_ROUTE)
    }

    const handleRouteChange = () => {
      setRoute(getAppRoute(window.location.pathname))
    }

    handleRouteChange()
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  React.useEffect(() => {
    if (isLoadingAuth) return

    if (isAuthenticated) {
      syncRoute(OVERVIEW_ROUTE)
      setRoute('overview')
      return
    }

    syncRoute(LOGIN_ROUTE)
    setRoute('login')
  }, [isAuthenticated, isLoadingAuth])

  if (isLoadingAuth) {
    return (
      <div className="login-page">
        <div className="login-main">
          <div className="login-right" style={{ width: '100%' }}>
            <div className="login-right-inner" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div className="login-logo">
                <Logo size="default" />
              </div>
              <p className="login-welcome">Loading your session...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isAuthenticated && route === 'overview') {
    return (
      <ToastProvider>
        <UnreadCountProvider>
          <Layout onLogout={logout} />
        </UnreadCountProvider>
      </ToastProvider>
    )
  }

  return <Login />
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)

