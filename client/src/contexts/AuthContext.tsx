import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

type AuthContextValue = {
  isAuthenticated: boolean
  isLoadingAuth: boolean
  token: string | null
  username: string | null
  login: (username?: string, password?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const ACTIVE_PAGE_STORAGE_KEY = 'aml_active_page'
const POST_LOGIN_PAGE_STORAGE_KEY = 'aml_post_login_page'
const LOGIN_REQUEST_TIMEOUT_MS = 10000
const VERIFY_REQUEST_TIMEOUT_MS = 10000

function toNetworkErrorMessage(error: unknown, apiBaseUrl: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `Cannot reach the backend at ${apiBaseUrl}. Please make sure the Django server is running.`
  }
  if (error instanceof TypeError) {
    return `Cannot reach the backend at ${apiBaseUrl}. Please make sure the Django server is running.`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Request failed. Please try again.'
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('auth_username'))
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem('auth_token')))
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false)
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

  const login = useCallback(async (username?: string, password?: string) => {
    if (!username || !password) {
      throw new Error('Username and password are required.')
    }
    let response: Response
    try {
      response = await fetchWithTimeout(`${API_BASE_URL}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }, LOGIN_REQUEST_TIMEOUT_MS)
    } catch (error) {
      throw new Error(toNetworkErrorMessage(error, API_BASE_URL))
    }
    if (!response.ok) {
      let message = 'Invalid credentials.'
      try {
        const payload = (await response.json()) as { detail?: string; non_field_errors?: string[]; username?: string[]; password?: string[] }
        message =
          payload.detail ||
          payload.non_field_errors?.[0] ||
          payload.username?.[0] ||
          payload.password?.[0] ||
          message
      } catch {
        // Keep default message when error payload is not JSON.
      }
      throw new Error(message)
    }
    const payload = (await response.json()) as { token?: string }
    if (!payload.token) {
      throw new Error('Login failed: token not returned.')
    }
    localStorage.setItem('auth_token', payload.token)
    localStorage.setItem('auth_username', username)
    localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, 'dashboard')
    sessionStorage.setItem(POST_LOGIN_PAGE_STORAGE_KEY, 'dashboard')
    setIsAuthenticated(true)
    setToken(payload.token)
    setUsername(username)
    setIsLoadingAuth(false)
  }, [API_BASE_URL])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    sessionStorage.removeItem(POST_LOGIN_PAGE_STORAGE_KEY)
    setIsAuthenticated(false)
    setToken(null)
    setUsername(null)
    setIsLoadingAuth(false)
  }, [])

  useEffect(() => {
    let isCancelled = false

    const verifyStoredToken = async () => {
      if (!token) {
        if (!isCancelled) {
          setIsAuthenticated(false)
          setIsLoadingAuth(false)
        }
        return
      }

      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/user/`, {
          headers: { Authorization: `Token ${token}` },
        }, VERIFY_REQUEST_TIMEOUT_MS)

        if (!response.ok) {
          if (!isCancelled) {
            logout()
          }
        } else if (!isCancelled) {
          setIsAuthenticated(true)
        }
      } catch (error) {
        if (!isCancelled && (error instanceof DOMException || error instanceof TypeError)) {
          // Keep the existing session alive when the backend is temporarily unavailable.
          setIsAuthenticated(true)
        } else if (!isCancelled) {
          logout()
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAuth(false)
        }
      }
    }

    void verifyStoredToken()
    return () => {
      isCancelled = true
    }
  }, [API_BASE_URL, logout, token])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoadingAuth, token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

