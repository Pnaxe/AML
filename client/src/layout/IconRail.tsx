import React, { useState, useRef, useEffect } from 'react'
import {
  HiOutlineHome,
  HiOutlineDatabase,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineSearch,
  HiOutlineCash,
  HiOutlineBell,
  HiOutlineBriefcase,
  HiOutlineDocumentReport,
  HiOutlineChip,
  HiOutlineCog,
  HiOutlineLogout,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './IconRail.css'
import type { AmlPageId } from './sections'

function getInitials(username: string | null | undefined): string {
  if (!username || !username.trim()) return '?'
  const raw = username.trim()
  const parts = raw.split(/[\s.@_-]+/).filter(Boolean)
  // For "Lead Pulse" / "leadpulse" use first word only so we show "LE" not "LP"
  const normalized = raw.toLowerCase().replace(/\s/g, '')
  if (normalized === 'leadpulse' && parts.length >= 1) {
    return parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].charAt(0).toUpperCase()
  }
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase().slice(0, 2)
  }
  if (parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return parts[0].charAt(0).toUpperCase()
}

type IconRailProps = {
  activeSection: AmlPageId
  onSelect: (section: AmlPageId) => void
  onLogout?: () => void
}

const ICON_SECTIONS: {
  key: AmlPageId
  label: string
  icon: React.ReactNode
}[] = [
  { key: 'dashboard', label: 'Overview', icon: <HiOutlineHome size={20} /> },
  { key: 'data-management', label: 'Data Upload', icon: <HiOutlineDatabase size={20} /> },
  { key: 'customers', label: 'Customers', icon: <HiOutlineUsers size={20} /> },
  { key: 'kyc', label: 'Onboarding & KYC', icon: <HiOutlineShieldCheck size={20} /> },
  { key: 'screening', label: 'Screening', icon: <HiOutlineSearch size={20} /> },
  { key: 'transactions', label: 'Transactions', icon: <HiOutlineCash size={20} /> },
  { key: 'alerts', label: 'Alerts', icon: <HiOutlineBell size={20} /> },
  { key: 'cases', label: 'Cases', icon: <HiOutlineBriefcase size={20} /> },
  { key: 'modelling', label: 'Modelling', icon: <HiOutlineChip size={20} /> },
  { key: 'reports', label: 'Reports', icon: <HiOutlineDocumentReport size={20} /> },
  { key: 'configurations', label: 'Configurations', icon: <HiOutlineCog size={20} /> },
]

export const IconRail: React.FC<IconRailProps> = ({ activeSection, onSelect, onLogout }) => {
  const { username } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initials = getInitials(username)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
    onLogout?.()
  }

  const isItemActive = (key: AmlPageId) => {
    if (key === 'screening') {
      return activeSection === 'screening' || activeSection === 'screening-manual' || activeSection === 'screening-approved' || activeSection === 'screening-declined'
    }
    if (key === 'transactions') {
      return activeSection === 'transactions' || activeSection === 'transactions-upload' || activeSection === 'transactions-upload-data'
    }
    if (key === 'modelling') {
      return activeSection === 'modelling' || activeSection === 'modelling-load' || activeSection === 'modelling-calibration' || activeSection === 'modelling-testing'
    }
    if (key === 'reports') {
      return activeSection === 'reports' || activeSection === 'reports-sar' || activeSection === 'reports-exports'
    }
    if (key === 'configurations') {
      return activeSection === 'configurations' || activeSection === 'configurations-email' || activeSection === 'configurations-risk' || activeSection === 'configurations-api'
    }
    return activeSection === key
  }

  return (
    <aside className="icon-rail">
      <div className="icon-rail-top">
        {ICON_SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`icon-rail-item ${isItemActive(item.key) ? 'active' : ''}`}
            title={item.label}
            onClick={() => onSelect(item.key)}
          >
            <span className="icon-rail-icon">{item.icon}</span>
          </button>
        ))}
      </div>
      <div className="icon-rail-bottom" ref={menuRef}>
        <button
          type="button"
          className="icon-rail-avatar"
          title="User menu"
          aria-label="User menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {initials}
        </button>
        {menuOpen && onLogout && (
          <div className="icon-rail-avatar-menu">
            <button type="button" className="icon-rail-menu-item" onClick={handleLogout}>
              <HiOutlineLogout size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

