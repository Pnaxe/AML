import React from 'react'
import {
  HiOutlineViewGrid,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCash,
  HiOutlineBell,
  HiOutlineBriefcase,
  HiOutlineDocumentReport,
  HiOutlineChip,
  HiOutlineDatabase,
  HiOutlineClipboardCheck,
  HiOutlineCog,
} from 'react-icons/hi'
import './Sidebar.css'
import { Logo } from './Logo'
import type { AmlPageId } from './sections'
import { AML_SECTIONS } from './sections'

type SidebarProps = {
  open: boolean
  setOpen: (open: boolean) => void
  activePage: AmlPageId
  onSelect: (page: AmlPageId) => void
}

const iconForPage = (id: AmlPageId): React.ReactNode => {
  switch (id) {
    case 'dashboard':
      return <HiOutlineViewGrid size={18} />
    case 'activity-feed':
      return <HiOutlineClock size={18} />
    case 'performance':
      return <HiOutlineChartBar size={18} />
    case 'customers':
      return <HiOutlineUsers size={18} />
    case 'kyc':
      return <HiOutlineShieldCheck size={18} />
    case 'screening':
      return <HiOutlineSearch size={18} />
    case 'screening-manual':
      return <HiOutlineSearch size={18} />
    case 'screening-approved':
      return <HiOutlineCheckCircle size={18} />
    case 'screening-declined':
      return <HiOutlineXCircle size={18} />
    case 'transactions':
      return <HiOutlineCash size={18} />
    case 'transactions-upload':
      return <HiOutlineDatabase size={18} />
    case 'transactions-upload-data':
      return <HiOutlineDatabase size={18} />
    case 'alerts':
      return <HiOutlineBell size={18} />
    case 'cases':
      return <HiOutlineBriefcase size={18} />
    case 'sar':
      return <HiOutlineDocumentReport size={18} />
    case 'modelling':
      return <HiOutlineChip size={18} />
    case 'modelling-load':
      return <HiOutlineChip size={18} />
    case 'modelling-calibration':
      return <HiOutlineChip size={18} />
    case 'modelling-testing':
      return <HiOutlineChip size={18} />
    case 'data-management':
      return <HiOutlineDatabase size={18} />
    case 'data-validation':
      return <HiOutlineCheckCircle size={18} />
    case 'validated-data':
      return <HiOutlineClipboardCheck size={18} />
    case 'reports':
      return <HiOutlineDocumentReport size={18} />
    case 'reports-sar':
      return <HiOutlineDocumentReport size={18} />
    case 'reports-exports':
      return <HiOutlineDocumentReport size={18} />
    case 'configurations':
      return <HiOutlineCog size={18} />
    case 'configurations-email':
      return <HiOutlineCog size={18} />
    case 'configurations-risk':
      return <HiOutlineCog size={18} />
    case 'configurations-api':
      return <HiOutlineCog size={18} />
    default:
      return null
  }
}

export const Sidebar: React.FC<SidebarProps> = ({ open, setOpen, activePage, onSelect }) => {
  const handleNavClick = (id: AmlPageId) => {
    onSelect(id)
    if (window.innerWidth < 1024) {
      setOpen(false)
    }
  }

  const dashboardGroup: AmlPageId[] = ['dashboard', 'activity-feed', 'performance']
  const dataGroup: AmlPageId[] = ['data-management', 'data-validation', 'validated-data']
  const screeningGroup: AmlPageId[] = ['screening', 'screening-manual', 'screening-approved', 'screening-declined']
  const transactionsGroup: AmlPageId[] = ['transactions', 'transactions-upload', 'transactions-upload-data']
  const modellingGroup: AmlPageId[] = ['modelling', 'modelling-load', 'modelling-calibration', 'modelling-testing']
  const reportsGroup: AmlPageId[] = ['reports', 'reports-sar', 'reports-exports']
  const configurationsGroup: AmlPageId[] = ['configurations', 'configurations-email', 'configurations-risk', 'configurations-api']
  const visibleSections = dashboardGroup.includes(activePage)
    ? AML_SECTIONS.filter((item) => dashboardGroup.includes(item.id))
    : dataGroup.includes(activePage)
      ? AML_SECTIONS.filter((item) => dataGroup.includes(item.id))
      : screeningGroup.includes(activePage)
        ? AML_SECTIONS.filter((item) => screeningGroup.includes(item.id))
      : transactionsGroup.includes(activePage)
          ? AML_SECTIONS.filter((item) => transactionsGroup.includes(item.id))
        : modellingGroup.includes(activePage)
          ? AML_SECTIONS.filter((item) => modellingGroup.includes(item.id))
        : reportsGroup.includes(activePage)
          ? AML_SECTIONS.filter((item) => reportsGroup.includes(item.id))
        : configurationsGroup.includes(activePage)
          ? AML_SECTIONS.filter((item) => configurationsGroup.includes(item.id))
        : AML_SECTIONS.filter((item) => item.id === activePage)

  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-wrap">
            <Logo />
          </div>
        </div>
        <nav className="sidebar-nav">
          {visibleSections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="sidebar-nav-icon">{iconForPage(item.id)}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      {open && (
        <div className="sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </>
  )
}

