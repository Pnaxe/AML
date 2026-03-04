import React, { createContext, useContext, useState, useCallback } from 'react'

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  username: string | null
  login: (username?: string, password?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('auth_username'))
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem('auth_token')))
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

  const login = useCallback(async (username?: string, password?: string) => {
    if (!username || !password) {
      throw new Error('Username and password are required.')
    }
    const response = await fetch(`${API_BASE_URL}/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!response.ok) {
      throw new Error('Invalid credentials.')
    }
    const payload = (await response.json()) as { token?: string }
    if (!payload.token) {
      throw new Error('Login failed: token not returned.')
    }
    localStorage.setItem('auth_token', payload.token)
    localStorage.setItem('auth_username', username)
    setIsAuthenticated(true)
    setToken(payload.token)
    setUsername(username)
  }, [API_BASE_URL])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    setIsAuthenticated(false)
    setToken(null)
    setUsername(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, username, login, logout }}>
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

