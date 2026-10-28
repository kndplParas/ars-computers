import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/adminAuthContext'
import { useAdminData } from '../../context/adminDataContext'

/**
 * ============================================================================
 * ARS Computers — Admin Layout Shell
 * ============================================================================
 * Provides persistent top header, responsive sidebar, user badge,
 * and navigation tabs for administrative modules.
 * ============================================================================
 */
export default function AdminLayout({ activeTab, onTabChange, children }) {
  const { adminUser, logout } = useAdminAuth()
  const { metrics, categories, enquiries, orders, isLiveDatabase } = useAdminData()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/admin/login')
    }
  }

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', badge: 'Overview', roles: ['superadmin', 'admin', 'inventory_staff'] },
    { id: 'orders', label: 'Orders & Sales', icon: '🛒', badge: `${orders?.length ?? 0} Orders`, roles: ['superadmin', 'admin', 'inventory_staff'] },
    { id: 'enquiries', label: 'Enquiries', icon: '💬', badge: `${enquiries?.length ?? 0} Leads`, roles: ['superadmin', 'admin'] },
    { id: 'products', label: 'Products', icon: '📦', badge: `${metrics?.products?.total ?? 0} Items`, roles: ['superadmin', 'admin'] },
    { id: 'inventory', label: 'Inventory', icon: '⚡', badge: `${(metrics?.products?.lowStock ?? 0) > 0 ? `${metrics.products.lowStock} Low` : 'Stock'}`, roles: ['superadmin', 'admin', 'inventory_staff'] },
    { id: 'categories', label: 'Categories', icon: '📁', badge: `${categories?.length ?? 0} Groups`, roles: ['superadmin', 'admin'] },
    { id: 'staff', label: 'Staff Management', icon: '👥', badge: metrics?.staff?.total ? `${metrics.staff.total} Users` : 'Staff', roles: ['superadmin'] }
  ]

  const userRole = adminUser?.role || 'inventory_staff'
  const navItems = allNavItems.filter((item) => item.roles.includes(userRole))

  const handleNavClick = (itemId) => {
    const targetItem = allNavItems.find((i) => i.id === itemId)
    if (targetItem && !targetItem.roles.includes(userRole)) {
      return // Prevent unauthorized navigation
    }

    if (onTabChange) {
      onTabChange(itemId)
    }
    if (itemId === 'orders') {
      navigate('/admin/orders')
    } else if (itemId === 'products') {
      navigate('/admin/products')
    } else if (itemId === 'inventory') {
      navigate('/admin/inventory')
    } else if (itemId === 'categories') {
      navigate('/admin/categories')
    } else if (itemId === 'enquiries') {
      navigate('/admin/enquiries')
    } else if (itemId === 'staff') {
      navigate('/admin/staff')
    } else if (itemId === 'dashboard') {
      navigate('/admin')
    } else {
      navigate(`/admin?tab=${itemId}`)
    }
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="admin-shell">
      {/* Top Header */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            type="button"
            className="admin-mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle admin navigation menu"
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>

          <Link to="/admin" className="admin-topbar-brand" title="ARS Computers Admin Dashboard">
            <img
              src="/logo.svg"
              alt="ARS Computers Flower Symbol"
              className="ars-logo-flower admin-logo-flower"
              width="46"
              height="46"
            />
            <div className="admin-brand-text">
              <span className="admin-brand-name">ARS Computers</span>
              <span className="admin-brand-tag">IT &amp; SECURITY SYSTEMS</span>
            </div>
            <span className="admin-portal-pill">Admin Console</span>
          </Link>
        </div>

        <div className="admin-topbar-right">
          <Link to="/" className="btn-outline btn-sm admin-live-site-btn" target="_blank" rel="noreferrer">
            <span>🌐 View Customer Website</span>
          </Link>

          <div className="admin-user-profile-badge">
            <div className="admin-avatar-circle">
              {adminUser?.fullName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{adminUser?.fullName || 'Staff User'}</span>
              <span className={`admin-user-role-chip role-${adminUser?.role || 'staff'}`}>
                {adminUser?.role === 'superadmin'
                  ? '👑 Superadmin'
                  : adminUser?.role === 'admin'
                  ? '💼 Admin (Read-Only)'
                  : adminUser?.role === 'inventory_staff'
                  ? '📦 Inventory Staff'
                  : 'Staff User'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
            title="Log out of admin session"
          >
            <span className="logout-icon" aria-hidden="true">🚪</span>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Workspace: Sidebar + Content */}
      <div className="admin-workspace">
        {/* Mobile Sidebar Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation */}
        <aside className={`admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="admin-sidebar-header">
            <span className="sidebar-section-title">ADMINISTRATIVE MODULES</span>
            <button
              type="button"
              className="admin-sidebar-close-btn"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation drawer"
            >
              ✕
            </button>
          </div>

          <nav className="admin-nav-list">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <span className="nav-item-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && (
                    <span className={`nav-item-badge ${isActive ? 'badge-active' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="sidebar-environment-card">
              <div className="env-status-indicator">
                <span className="env-pulse-dot" style={isLiveDatabase ? { background: '#10b981' } : undefined}></span>
                <strong>{isLiveDatabase ? 'Supabase Live' : 'Demo Mode'}</strong>
              </div>
              <p className="env-subtext">
                {isLiveDatabase ? 'Connected to PostgreSQL' : 'Changes saved in this browser only'}
              </p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="admin-content-pane">
          {children}
        </main>
      </div>
    </div>
  )
}
