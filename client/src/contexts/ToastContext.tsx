import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { HiOutlineCheckCircle } from 'react-icons/hi'
import './Toast.css'

type ToastContextValue = {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_DURATION = 4000

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible || !message) return
    const timer = setTimeout(() => {
      setVisible(false)
    }, TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [visible, message])

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setMessage(null), 300)
      return () => clearTimeout(timer)
    }
  }, [visible])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          className={`toast ${visible ? 'toast-visible' : 'toast-hidden'}`}
          role="status"
          aria-live="polite"
        >
          <HiOutlineCheckCircle size={20} className="toast-icon" />
          <span className="toast-message">{message}</span>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
