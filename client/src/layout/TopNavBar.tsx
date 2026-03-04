import React, { useEffect, useRef, useState } from 'react'
import { HiOutlineBell } from 'react-icons/hi'
import { Logo } from './Logo'
import './TopNavBar.css'

type TopNavBarProps = {
  onMenuClick: () => void
  activeSectionLabel: string
  onSidebarToggle: () => void
  isSidebarHidden: boolean
  userInitials: string
  onLogout?: () => void
  onNotificationsClick?: () => void
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  onMenuClick,
  activeSectionLabel,
  onSidebarToggle,
  isSidebarHidden,
  userInitials,
  onLogout,
  onNotificationsClick,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [userMenuOpen])

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="Toggle sidebar"
          onClick={onMenuClick}
        >
          <span className="menu-icon-line" />
          <span className="menu-icon-line" />
          <span className="menu-icon-line" />
        </button>
        <div className="top-nav-mobile-logo">
          <Logo size="small" />
        </div>
        <span className="top-nav-section-label">{activeSectionLabel}</span>
      </div>
      <div className="top-nav-right">
        <button type="button" className="sidebar-toggle-button" onClick={onSidebarToggle}>
          {isSidebarHidden ? 'Show Sidebar' : 'Hide Sidebar'}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Notifications"
          onClick={onNotificationsClick}
        >
          <span className="notification-dot" />
          <HiOutlineBell size={20} className="notification-icon" />
        </button>
        <div className="top-nav-user-menu" ref={userMenuRef}>
          <button
            type="button"
            className="top-nav-user-avatar"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            {userInitials}
          </button>
          {userMenuOpen && onLogout && (
            <div className="top-nav-user-dropdown">
              <button
                type="button"
                className="top-nav-user-dropdown-item"
                onClick={() => {
                  setUserMenuOpen(false)
                  onLogout()
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

