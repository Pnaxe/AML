import React, { useState } from 'react'
import { Logo } from '../layout/Logo'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-main">
        <div className="login-left">
          <h1 className="login-left-title">AML Command Center</h1>
          <p className="login-left-tagline">
            Monitor transactions, detect suspicious activity, manage alerts and cases, and keep compliance workflows centralized in one secure AML platform.
          </p>
        </div>

        <div className="login-right">
          <div className="login-right-inner">
            <div className="login-logo">
              <Logo size="default" />
            </div>
            <p className="login-welcome">Welcome back, good to see you again!</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="login-error" role="alert">{error}</p>}
              <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Logging in...' : 'Log In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
