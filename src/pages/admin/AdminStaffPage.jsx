import { useState, useMemo, useId } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAdminAuth } from '../../context/adminAuthContext'
import { useAdminData } from '../../context/adminDataContext'

/**
 * ============================================================================
 * ARS Computers — Superadmin-Only Staff Management Console
 * ============================================================================
 * Provides secure personnel administration, role-based access control,
 * account suspension/reactivation, and zero-trust authentication auditing.
 * ============================================================================
 */

function formatDate(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export default function AdminStaffPage() {
  const { adminUser } = useAdminAuth()
  const {
    staff,
    metrics,
    isLiveDatabase,
    isLoadingStaff,
    staffError,
    loadAdminStaff,
    updateStaffRole,
    toggleStaffActive,
    addStaffMember
  } = useAdminData()

  // Register Staff Profile Form State
  const [inviteForm, setInviteForm] = useState({
    authId: '',
    email: '',
    fullName: '',
    role: 'admin'
  })
  const [inviteError, setInviteError] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all') // 'all', 'superadmin', 'admin', 'inventory_staff'
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'inactive'

  // Modals State
  const [roleModalTarget, setRoleModalTarget] = useState(null)
  const [newSelectedRole, setNewSelectedRole] = useState('admin')
  const [statusModalTarget, setStatusModalTarget] = useState(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Feedback Notifications
  const [notification, setNotification] = useState(null)

  const showNotification = (text, type = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleRegisterStaff = async (e) => {
    e.preventDefault()
    setInviteError(null)

    try {
      setIsRegistering(true)
      await addStaffMember({
        id: inviteForm.authId,
        email: inviteForm.email,
        fullName: inviteForm.fullName,
        role: inviteForm.role
      })
      showNotification(`Staff profile for "${inviteForm.fullName}" registered successfully.`, 'success')
      setIsInviteModalOpen(false)
      setInviteForm({ authId: '', email: '', fullName: '', role: 'admin' })
    } catch (err) {
      setInviteError(err.message || 'Failed to register staff profile.')
    } finally {
      setIsRegistering(false)
    }
  }

  // Filtered Staff Dataset
  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (member.full_name && member.full_name.toLowerCase().includes(q)) ||
        (member.email && member.email.toLowerCase().includes(q))

      const matchesRole = roleFilter === 'all' || member.role === roleFilter

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? member.is_active === true
          : member.is_active === false

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [staff, searchQuery, roleFilter, statusFilter])

  const hasActiveFilters =
    searchQuery.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all'

  const handleClearFilters = () => {
    setSearchQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  // Count active superadmins for invariant checks
  const activeSuperadminsCount = useMemo(() => {
    return staff.filter((s) => s.role === 'superadmin' && s.is_active === true).length
  }, [staff])

  // Open Role Assignment Modal
  const handleOpenRoleModal = (member) => {
    setRoleModalTarget(member)
    setNewSelectedRole(member.role === 'inventory_staff' ? 'inventory_staff' : 'admin')
  }

  // Submit Role Change
  const handleConfirmRoleChange = async (e) => {
    e.preventDefault()
    if (!roleModalTarget) return

    setIsSubmitting(true)
    try {
      await updateStaffRole(roleModalTarget.id, newSelectedRole)
      showNotification(
        `Staff role for "${roleModalTarget.full_name}" successfully updated to "${newSelectedRole}".`
      )
      setRoleModalTarget(null)
    } catch (err) {
      showNotification(err.message || 'Failed to update staff role.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Active Status Toggle
  const handleConfirmStatusToggle = async () => {
    if (!statusModalTarget) return

    const targetName = statusModalTarget.full_name
    const targetStatus = !statusModalTarget.is_active

    setIsSubmitting(true)
    try {
      await toggleStaffActive(statusModalTarget.id, targetStatus)
      showNotification(
        `Staff account "${targetName}" is now ${targetStatus ? 'Activated' : 'Suspended'}.`
      )
      setStatusModalTarget(null)
    } catch (err) {
      showNotification(err.message || 'Failed to update account status.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleFilterId = useId()
  const statusFilterId = useId()

  return (
    <AdminLayout activeTab="staff">
      {/* Toast Notification */}
      {notification && (
        <div className={`admin-action-toast ${notification.type}`}>
          <span className="toast-icon">
            {notification.type === 'success' ? '✓' : '⚠️'}
          </span>
          <span className="toast-message">{notification.text}</span>
        </div>
      )}

      <div className="admin-products-view-container">
        {/* Page Header */}
        <div className="admin-view-header">
          <div>
            <div className="admin-page-title-wrap">
              <h1 className="admin-view-title">Staff Management</h1>
              <span
                className="live-db-pill"
                style={{
                  background: '#f3e8ff',
                  color: '#7e22ce',
                  fontWeight: 600,
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8rem'
                }}
                title="Restricted strictly to authenticated Superadministrators"
              >
                🔒 Superadmin Only
              </span>
              {isLiveDatabase ? (
                <span
                  className="live-db-pill"
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}
                  title="Connected to Supabase PostgreSQL database"
                >
                  🟢 Supabase Live
                </span>
              ) : (
                <span
                  className="live-db-pill"
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}
                  title="Operating in local evaluation state"
                >
                  ⚡ Demo Mode
                </span>
              )}
            </div>
            <p className="admin-view-subtext">
              Directory of authorized ARS Computers store personnel, role permissions, and access status.
            </p>
          </div>

          <div className="admin-header-actions-group">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => loadAdminStaff()}
              disabled={isLoadingStaff}
              title="Refresh personnel records from database"
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsInviteModalOpen(true)}
              title="Invite or provision new staff account"
            >
              <span>+ Invite Staff Member</span>
            </button>
          </div>
        </div>

        {/* Staff Metrics Summary Cards */}
        <div
          className="admin-metrics-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}
        >
          <div className="admin-metric-card">
            <div className="metric-card-content">
              <span className="metric-label">Total Staff</span>
              <span className="metric-value">{metrics.staff?.total ?? staff.length}</span>
            </div>
            <div className="metric-icon-wrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              👥
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="metric-card-content">
              <span className="metric-label">Superadmins</span>
              <span className="metric-value" style={{ color: '#6b21a8' }}>
                {metrics.staff?.superadmins ?? staff.filter((s) => s.role === 'superadmin').length}
              </span>
            </div>
            <div className="metric-icon-wrap" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
              🛡️
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="metric-card-content">
              <span className="metric-label">Store Admins</span>
              <span className="metric-value" style={{ color: '#0369a1' }}>
                {metrics.staff?.admins ?? staff.filter((s) => s.role === 'admin').length}
              </span>
            </div>
            <div className="metric-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              💼
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="metric-card-content">
              <span className="metric-label">Inventory Staff</span>
              <span className="metric-value" style={{ color: '#0f766e' }}>
                {metrics.staff?.inventoryStaff ?? staff.filter((s) => s.role === 'inventory_staff').length}
              </span>
            </div>
            <div className="metric-icon-wrap" style={{ background: '#ccfbf1', color: '#0f766e' }}>
              📦
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="metric-card-content">
              <span className="metric-label">Active Accounts</span>
              <span className="metric-value" style={{ color: '#15803d' }}>
                {metrics.staff?.active ?? staff.filter((s) => s.is_active !== false).length}
              </span>
            </div>
            <div className="metric-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              ✓
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="metric-card-content">
              <span className="metric-label">Suspended</span>
              <span className="metric-value" style={{ color: '#b91c1c' }}>
                {metrics.staff?.inactive ?? staff.filter((s) => s.is_active === false).length}
              </span>
            </div>
            <div className="metric-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
              ✕
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="admin-filter-bar">
          <div className="filter-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search staff members"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search input"
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-selects-group">
            {/* Role Filter */}
            <div className="filter-select-wrap">
              <label htmlFor={roleFilterId} className="filter-label-inline">
                Role:
              </label>
              <select
                id={roleFilterId}
                className="admin-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles ({staff.length})</option>
                <option value="superadmin">Superadmin</option>
                <option value="admin">Store Admin</option>
                <option value="inventory_staff">Inventory Staff</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="filter-select-wrap">
              <label htmlFor={statusFilterId} className="filter-label-inline">
                Status:
              </label>
              <select
                id={statusFilterId}
                className="admin-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Suspended Only</option>
              </select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-filters"
                onClick={handleClearFilters}
                title="Reset all search filters"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Summary Bar */}
        <div className="product-results-summary-bar">
          <span className="results-count-text">
            Showing <strong>{filteredStaff.length}</strong> of {staff.length} staff members
            {hasActiveFilters && ' (filtered)'}
          </span>
          {isLiveDatabase ? (
            <span className="live-notice-tag" style={{ color: '#047857', fontWeight: 600 }}>
              🟢 Live Directory — Queries public.admin_users enforced by PostgreSQL RLS
            </span>
          ) : (
            <span className="demo-notice-tag">
              ℹ️ Demo Mode — Local simulated staff directory
            </span>
          )}
        </div>

        {/* Database Error Alert */}
        {staffError && (
          <div
            className="admin-login-alert error"
            role="alert"
            style={{
              marginBottom: '20px',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            <span className="alert-icon" style={{ fontSize: '1.4rem' }}>
              ⚠️
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '4px', fontSize: '1rem' }}>
                Staff Directory Synchronization Error
              </strong>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.4' }}>
                {staffError}
              </p>
              <button
                type="button"
                className="btn-outline btn-sm"
                style={{ marginTop: '10px' }}
                onClick={() => loadAdminStaff()}
              >
                🔄 Retry Database Query
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoadingStaff && (
          <div
            className="admin-loading-card"
            style={{
              margin: '30px auto',
              textAlign: 'center',
              padding: '32px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}
          >
            <div className="loading-spinner"></div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>
              Loading Personnel Directory...
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Querying verified staff members from public.admin_users.
            </p>
          </div>
        )}

        {/* Staff Data Table */}
        <div className="admin-table-container">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Staff Member</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Account Status</th>
                <th>Date Added</th>
                <th className="text-right" style={{ minWidth: '180px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="admin-empty-cell">
                    <div className="empty-state-wrap">
                      <span className="empty-icon" aria-hidden="true">👥</span>
                      <h3>No staff records found</h3>
                      <p>Try searching for a different name or resetting filter criteria.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          style={{ marginTop: '12px' }}
                          onClick={handleClearFilters}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const isCurrentUser = member.id === adminUser?.id
                  const isMemberSuperadmin = member.role === 'superadmin'
                  const isLastActiveSuperadmin =
                    isMemberSuperadmin && member.is_active && activeSuperadminsCount <= 1

                  let roleBadgeStyle = {
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd'
                  }
                  let roleIcon = '💼'
                  let roleDisplay = 'Store Admin'

                  if (member.role === 'superadmin') {
                    roleBadgeStyle = {
                      background: '#f3e8ff',
                      color: '#7e22ce',
                      border: '1px solid #e9d5ff'
                    }
                    roleIcon = '🛡️'
                    roleDisplay = 'Superadmin'
                  } else if (member.role === 'inventory_staff') {
                    roleBadgeStyle = {
                      background: '#ccfbf1',
                      color: '#0f766e',
                      border: '1px solid #99f6e4'
                    }
                    roleIcon = '📦'
                    roleDisplay = 'Inventory Staff'
                  }

                  return (
                    <tr
                      key={member.id}
                      style={!member.is_active ? { opacity: 0.75, background: '#fafbfc' } : undefined}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              background: member.role === 'superadmin' ? '#4f46e5' : '#0284c7',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              flexShrink: 0
                            }}
                          >
                            {member.full_name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {member.full_name}
                              {isCurrentUser && (
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                    fontSize: '0.72rem',
                                    fontWeight: 700
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              ID: {member.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <a
                          href={`mailto:${member.email}`}
                          style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}
                        >
                          {member.email}
                        </a>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            ...roleBadgeStyle
                          }}
                        >
                          <span>{roleIcon}</span>
                          <span>{roleDisplay}</span>
                        </span>
                      </td>

                      <td>
                        {member.is_active ? (
                          <span
                            className="status-pill availability-in_stock"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span style={{ color: '#16a34a' }}>●</span> Active
                          </span>
                        ) : (
                          <span
                            className="status-pill availability-out_of_stock"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span style={{ color: '#dc2626' }}>●</span> Suspended
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.88rem', color: '#475569' }} title={`Created at: ${formatDateTime(member.created_at)}`}>
                        {formatDate(member.created_at)}
                      </td>

                      <td className="text-right">
                        <div className="table-actions-group">
                          {/* Role Modification Button */}
                          <button
                            type="button"
                            className="btn-action-icon edit"
                            onClick={() => handleOpenRoleModal(member)}
                            disabled={isCurrentUser || isMemberSuperadmin}
                            title={
                              isCurrentUser
                                ? 'Self-demotion prevented: You cannot alter your own superadministrator role.'
                                : isMemberSuperadmin
                                ? 'Superadmin roles are protected and cannot be downgraded via web console.'
                                : 'Change assigned staff role (Admin or Inventory Staff)'
                            }
                          >
                            Change Role
                          </button>

                          {/* Status Activation/Deactivation Button */}
                          {member.is_active ? (
                            <button
                              type="button"
                              className="btn-action-icon deactivate"
                              onClick={() => setStatusModalTarget(member)}
                              disabled={isCurrentUser || isLastActiveSuperadmin}
                              title={
                                isCurrentUser
                                  ? 'Self-deactivation prevented: You cannot deactivate your own superadmin account.'
                                  : isLastActiveSuperadmin
                                  ? 'Action blocked: Cannot deactivate the last remaining active superadministrator.'
                                  : 'Suspend staff access to admin console'
                              }
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-action-icon reactivate"
                              onClick={() => setStatusModalTarget(member)}
                              title="Restore staff member access to admin console"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: Invite Staff / Architectural Prerequisite Explanation       */}
      {/* ==================================================================== */}
      {isInviteModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setIsInviteModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
        >
          <div
            className="admin-modal-dialog"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="invite-modal-title" className="admin-modal-title">
                  Invite Staff Member
                </h2>
                <span className="modal-subtitle-note">
                  Supabase Auth Zero-Trust Provisioning Architecture
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsInviteModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#334155' }}>
                  <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    Strict Client Security Policy: Zero Service-Role Exposure
                  </strong>
                  Per application security requirements, browser-side code never possesses the Supabase
                  service-role secret key or elevated Auth admin privileges. New Auth accounts cannot be
                  directly forged from the browser.
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                  Administrative User Provisioning Workflow:
                </h3>
                <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: '#475569' }}>
                  <li>
                    <strong>Cloud Supabase (Online):</strong> Open the{' '}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Supabase Cloud Dashboard (Authentication &gt; Users)
                    </a>{' '}
                    to create an auth user, then copy their User UID.
                  </li>
                  <li>
                    <strong>Local Docker (Offline dev):</strong> Requires Docker Desktop running. If started, local Studio is at{' '}
                    <a
                      href="http://127.0.0.1:54323/project/default/auth/users"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0284c7', fontWeight: 600 }}
                    >
                      http://127.0.0.1:54323
                    </a>
                    {' '}<em style={{ fontSize: '0.8rem', color: '#64748b' }}>(Will not open if Docker is stopped)</em>.
                  </li>
                  <li>
                    <strong>Database Directory:</strong> Insert the matching staff profile into <code>public.admin_users</code> with the desired initial role (<code>admin</code> or <code>inventory_staff</code>).
                  </li>
                </ol>
              </div>

              {!isLiveDatabase && (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '0.88rem',
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <strong>⚡ Demo Mode Active:</strong> You do not need to open Supabase Auth or Docker! You can generate a mock ID and test staff registration immediately.
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 10px', background: '#ffffff' }}
                    onClick={() => {
                      const demoId = 'demo-usr-' + Math.random().toString(36).slice(2, 10)
                      setInviteForm((prev) => ({
                        ...prev,
                        authId: demoId,
                        fullName: prev.fullName || 'Demo Staff Associate',
                        email: prev.email || `staff.${Math.random().toString(36).slice(2, 6)}@arscomputers.example.com`
                      }))
                    }}
                  >
                    ✨ Auto-Fill Demo Staff
                  </button>
                </div>
              )}

              <div
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '14px',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto'
                }}
              >
                <div style={{ color: '#94a3b8', marginBottom: '6px' }}>-- Local SQL Provisioning Example:</div>
                <div>INSERT INTO public.admin_users (id, email, full_name, role, is_active)</div>
                <div>VALUES (&apos;&lt;AUTH_USER_UUID&gt;&apos;, &apos;staff@arscomputers.in&apos;, &apos;Staff Name&apos;, &apos;admin&apos;, true);</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
                  Register Staff Profile into Directory (public.admin_users):
                </h3>

                {inviteError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      marginBottom: '14px',
                      fontSize: '0.88rem'
                    }}
                    role="alert"
                  >
                    ⚠️ {inviteError}
                  </div>
                )}

                <form onSubmit={handleRegisterStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label
                        htmlFor="invite-auth-id"
                        style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}
                      >
                        Supabase Auth User UUID <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {!isLiveDatabase && (
                        <button
                          type="button"
                          onClick={() => {
                            setInviteForm((prev) => ({
                              ...prev,
                              authId: 'demo-usr-' + Math.random().toString(36).slice(2, 10)
                            }))
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#0284c7',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Generate Demo ID
                        </button>
                      )}
                    </div>
                    <input
                      id="invite-auth-id"
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. 12345678-abcd-1234-abcd-1234567890ab"
                      value={inviteForm.authId}
                      onChange={(e) => setInviteForm({ ...inviteForm, authId: e.target.value })}
                      required
                      disabled={isRegistering}
                      style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.78rem', display: 'block', marginTop: '3px' }}>
                      {isLiveDatabase
                        ? 'Copy from Supabase Dashboard > Authentication > Users > User UID.'
                        : 'In Demo Mode, any identifier or generated test UUID is accepted.'}
                    </small>
                  </div>

                  <div>
                    <label
                      htmlFor="invite-full-name"
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
                    >
                      Staff Full Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="invite-full-name"
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. Rajesh Kumar"
                      value={inviteForm.fullName}
                      onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                      required
                      disabled={isRegistering}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="invite-email"
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
                    >
                      Staff Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      className="admin-form-input"
                      placeholder="e.g. rajesh@arscomputers.in"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      required
                      disabled={isRegistering}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}
                    >
                      Assigned Administrative Role <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          border: inviteForm.role === 'admin' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          borderRadius: '6px',
                          background: inviteForm.role === 'admin' ? '#f0f9ff' : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name="inviteRole"
                          value="admin"
                          checked={inviteForm.role === 'admin'}
                          onChange={() => setInviteForm({ ...inviteForm, role: 'admin' })}
                          disabled={isRegistering}
                          style={{ marginTop: '3px' }}
                        />
                        <div>
                          <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>Admin (Operations Staff)</strong>
                          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            Can view products, manage customer enquiries and workflow statuses. Cannot alter inventory stock or delete catalog items.
                          </div>
                        </div>
                      </label>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          border: inviteForm.role === 'inventory_staff' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          borderRadius: '6px',
                          background: inviteForm.role === 'inventory_staff' ? '#f0f9ff' : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name="inviteRole"
                          value="inventory_staff"
                          checked={inviteForm.role === 'inventory_staff'}
                          onChange={() => setInviteForm({ ...inviteForm, role: 'inventory_staff' })}
                          disabled={isRegistering}
                          style={{ marginTop: '3px' }}
                        />
                        <div>
                          <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>Inventory Staff (Warehouse)</strong>
                          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            Dedicated inventory and stock level adjustments. Confidential enquiries and personnel directories are inaccessible.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setIsInviteModalOpen(false)
                        setInviteError(null)
                      }}
                      disabled={isRegistering}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isRegistering}
                    >
                      {isRegistering ? 'Registering...' : 'Register & Grant Staff Access'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: Change Staff Role Modal (Permitted: admin | inventory_staff) */}
      {/* ==================================================================== */}
      {roleModalTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => !isSubmitting && setRoleModalTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="role-modal-title" className="admin-modal-title">
                  Update Staff Role
                </h2>
                <span className="modal-subtitle-note">
                  Modifying permissions for {roleModalTarget.full_name}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRoleModalTarget(null)}
                disabled={isSubmitting}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRoleChange}>
              <div className="admin-modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                  Assign an authorized role for <strong>{roleModalTarget.full_name}</strong> (
                  {roleModalTarget.email}):
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: newSelectedRole === 'admin' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: newSelectedRole === 'admin' ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="staffRole"
                      value="admin"
                      checked={newSelectedRole === 'admin'}
                      onChange={() => setNewSelectedRole('admin')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.92rem' }}>
                        💼 Store Administrator (admin)
                      </strong>
                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Can manage products, categories, stock levels, and respond to customer enquiries. Cannot access staff management.
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: newSelectedRole === 'inventory_staff' ? '2px solid #0f766e' : '1px solid #cbd5e1',
                      background: newSelectedRole === 'inventory_staff' ? '#f0fdfa' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="staffRole"
                      value="inventory_staff"
                      checked={newSelectedRole === 'inventory_staff'}
                      onChange={() => setNewSelectedRole('inventory_staff')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.92rem' }}>
                        📦 Inventory Staff (inventory_staff)
                      </strong>
                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Restricted to reading the catalogue and updating physical stock counts. Excluded from confidential enquiries and product deletions.
                      </span>
                    </div>
                  </label>
                </div>

                <div
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    color: '#92400e',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  <span>⚠️</span>
                  <span>
                    In accordance with zero-trust RBAC principles, staff accounts cannot be elevated to Superadmin via client console.
                  </span>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setRoleModalTarget(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || newSelectedRole === roleModalTarget.role}
                >
                  {isSubmitting ? 'Updating...' : 'Save Role Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: Activate / Deactivate Confirmation Dialog                   */}
      {/* ==================================================================== */}
      {statusModalTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => !isSubmitting && setStatusModalTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-toggle-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="status-toggle-title" className="admin-modal-title">
                  {statusModalTarget.is_active ? 'Suspend Staff Account?' : 'Reactivate Staff Account?'}
                </h2>
                <span className="modal-subtitle-note">
                  Confirming state update for {statusModalTarget.full_name}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setStatusModalTarget(null)}
                disabled={isSubmitting}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              {statusModalTarget.is_active ? (
                <div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: '#334155', lineHeight: 1.5 }}>
                    Are you sure you want to deactivate <strong>{statusModalTarget.full_name}</strong> (
                    {statusModalTarget.email})?
                  </p>
                  <div
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '0.84rem',
                      color: '#991b1b',
                      lineHeight: 1.4
                    }}
                  >
                    <strong>Session Invalidation:</strong> The user will be immediately blocked from signing in. If they currently hold an active session, it will be automatically terminated on their next request.
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', lineHeight: 1.5 }}>
                  Are you sure you want to reactivate <strong>{statusModalTarget.full_name}</strong>? They will immediately regain authorization to sign in and access the console in accordance with their assigned role (
                  <strong>{statusModalTarget.role}</strong>).
                </p>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setStatusModalTarget(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={statusModalTarget.is_active ? 'btn-danger' : 'btn-primary'}
                onClick={handleConfirmStatusToggle}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Updating...'
                  : statusModalTarget.is_active
                  ? 'Confirm Deactivation'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
