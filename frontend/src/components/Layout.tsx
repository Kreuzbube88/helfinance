import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { NotificationPanel } from './NotificationPanel'
import { getNotifications } from '../api'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    localStorage.getItem('helfinance_sidebar') === 'collapsed'
  )
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('helfinance_theme') as 'dark' | 'light') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('helfinance_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('helfinance_sidebar', sidebarCollapsed ? 'collapsed' : 'expanded')
  }, [sidebarCollapsed])

  useEffect(() => {
    getNotifications()
      .then(data => setUnreadCount(data.filter(n => !n.read).length))
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleHamburger = () => {
    if (window.innerWidth <= 768) setSidebarOpen(true)
    else setSidebarCollapsed(prev => !prev)
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: '⊞' },
    { path: '/income', label: t('nav.income'), icon: '↑' },
    { path: '/expenses', label: t('nav.expenses'), icon: '↓' },
    { path: '/loans', label: t('nav.loans'), icon: '⊙' },
    { path: '/savings', label: t('nav.savings'), icon: '◈' },
    { path: '/cashflow', label: t('nav.cashflow'), icon: '≈' },
    { path: '/reports/monthly', label: t('nav.reports'), icon: '▦' },
    { path: '/household', label: t('nav.household'), icon: '⌂' },
  ]

  if (isAdmin) {
    navItems.push({ path: '/admin', label: t('nav.admin'), icon: '⚙' })
  }

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/favicon.png" alt="Logo" className="logo-icon" />
            <span className="logo-text">HELFINANCE</span>
          </div>
          <button
            className="sidebar-close btn btn-ghost"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? t('nav.profile') : undefined}
          >
            <span className="nav-icon">◉</span>
            <span className="nav-label">{t('nav.profile')}</span>
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? t('nav.about') : undefined}
          >
            <span className="nav-icon">ℹ</span>
            <span className="nav-label">{t('nav.about')}</span>
          </NavLink>
          <button
            className="nav-item nav-logout"
            onClick={handleLogout}
            title={sidebarCollapsed ? t('nav.logout') : undefined}
          >
            <span className="nav-icon">⏻</span>
            <span className="nav-label">{t('nav.logout')}</span>
          </button>
          <button
            className="btn btn-ghost sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(prev => !prev)}
            title={sidebarCollapsed ? t('common.sidebarExpand') : t('common.sidebarCollapse')}
            style={{ justifyContent: 'center', fontSize: '0.75rem' }}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-wrapper">
        {/* Header */}
        <header className="header">
          <button
            className="hamburger btn btn-ghost"
            onClick={handleHamburger}
            aria-label={t('common.toggleMenu')}
          >
            ☰
          </button>

          <div className="header-right">
            <button
              className="btn btn-ghost theme-toggle"
              onClick={toggleTheme}
              title={t('common.toggleTheme')}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>

            <button
              className="btn btn-ghost notif-btn"
              onClick={() => setNotifOpen(true)}
              aria-label={t('common.notifications')}
            >
              🔔
              {unreadCount > 0 && (
                <span className="badge badge-danger">{unreadCount}</span>
              )}
            </button>

            <div className="user-avatar" onClick={() => navigate('/profile')}>
              <span className="avatar-initials">
                {user?.username?.slice(0, 2).toUpperCase() || 'HF'}
              </span>
              <span className="avatar-name">{user?.username}</span>
              {isAdmin && <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>{t('admin.title')}</span>}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content">
          {children}
        </main>
      </div>

      {notifOpen && (
        <NotificationPanel
          onClose={() => setNotifOpen(false)}
          onUnreadCountChange={setUnreadCount}
        />
      )}
    </div>
  )
}
