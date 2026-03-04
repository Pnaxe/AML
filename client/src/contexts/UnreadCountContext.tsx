import React, { createContext, useContext, useState, useCallback } from 'react'

type UnreadContextValue = {
  unreadCount: number
  setUnreadCount: (value: number) => void
}

const UnreadContext = createContext<UnreadContextValue | undefined>(undefined)

export const UnreadCountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadCount, setUnreadCountState] = useState(0)

  const setUnreadCount = useCallback((value: number) => {
    setUnreadCountState(value)
  }, [])

  return (
    <UnreadContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </UnreadContext.Provider>
  )
}

export const useUnreadCount = (): UnreadContextValue => {
  const ctx = useContext(UnreadContext)
  if (!ctx) {
    throw new Error('useUnreadCount must be used within UnreadCountProvider')
  }
  return ctx
}

