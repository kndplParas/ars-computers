import { useState, useMemo } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import {
  SERVICE_STATUS_META,
  SERVICE_PRIORITY_META,
  SERVICE_CATEGORIES,
  REQUEST_TYPES
} from '../../data/mockServiceRequests'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'

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

function formatDateOnly(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export default function AdminServiceRequestsPage() {
  const { adminUser } = useAdminAuth()
  const isSuperadmin = adminUser?.role === 'superadmin'

  const {
    serviceRequests,
    isLoadingServiceRequests,
    serviceRequestsError,
    loadAdminServiceRequests,
    assignServiceTicket,
    updateServiceTicketStatus,
    updateServiceTicketTechnicalDetails,
    addServiceTicketNote,
    closeServiceTicket,
    reopenServiceTicket,
    metrics
  } = useAdminData()

  // Filters state
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [requestTypeFilter, setRequestTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer / Detail state
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [activeDrawerTab, setActiveDrawerTab] = useState('overview') // 'overview' | 'technical' | 'notes' | 'timeline'

  // Sub-actions state inside drawer
  const [assigneeName, setAssigneeName] = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)

  const [statusReason, setStatusReason] = useState('')
  const [targetStatus, setTargetStatus] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const [techFormData, setTechFormData] = useState({
    diagnosis: '',
    work_performed: '',
    estimated_cost: 0,
    final_cost: 0,
    warranty_status: 'under_evaluation',
    resolution_notes: '',
    parts_used: []
  })
  const [isSavingTech, setIsSavingTech] = useState(false)

  // New part input
  const [newPartName, setNewPartName] = useState('')
  const [newPartQty, setNewPartQty] = useState(1)
  const [newPartPrice, setNewPartPrice] = useState(0)

  // New internal note input
  const [newNoteText, setNewNoteText] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)

  // Reopen modal state
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [reopenReasonText, setReopenReasonText] = useState('')
  const [isReopening, setIsReopening] = useState(false)

  // Copy ticket feedback
  const [copiedId, setCopiedId] = useState(null)

  // Selected ticket object
  const selectedTicket = useMemo(() => {
    if (!selectedTicketId || !serviceRequests) return null
    return serviceRequests.find((t) => t.id === selectedTicketId) || null
  }, [selectedTicketId, serviceRequests])

  // Synchronize drawer sub-forms when selected ticket changes
  const handleSelectTicket = (ticket) => {
    setSelectedTicketId(ticket.id)
    setAssigneeName(ticket.assigned_to || '')
    setAssignNotes('')
    setTargetStatus(ticket.status || '')
    setStatusReason('')
    setTechFormData({
      diagnosis: ticket.diagnosis || '',
      work_performed: ticket.work_performed || '',
      estimated_cost: ticket.estimated_cost || 0,
      final_cost: ticket.final_cost || 0,
      warranty_status: ticket.warranty_status || 'under_evaluation',
      resolution_notes: ticket.resolution_notes || '',
      parts_used: Array.isArray(ticket.parts_used) ? [...ticket.parts_used] : []
    })
    setNewNoteText('')
    setActiveDrawerTab('overview')
  }

  const handleCopyTicket = (e, ticketNumber) => {
    e.stopPropagation()
    navigator.clipboard.writeText(ticketNumber)
    setCopiedId(ticketNumber)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    if (!Array.isArray(serviceRequests)) return []

    return serviceRequests.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      // Priority filter
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false
      }
      // Category filter
      if (categoryFilter !== 'all' && item.product_category !== categoryFilter) {
        return false
      }
      // Request type filter
      if (requestTypeFilter !== 'all' && item.request_type !== requestTypeFilter) {
        return false
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNumber = item.ticket_number?.toLowerCase().includes(q)
        const matchCustomer = item.customer_name?.toLowerCase().includes(q)
        const matchPhone = item.mobile_number?.toLowerCase().includes(q)
        const matchSerial = item.serial_number?.toLowerCase().includes(q)
        const matchModel = item.model_number?.toLowerCase().includes(q)
        const matchBrand = item.brand?.toLowerCase().includes(q)
        if (!matchNumber && !matchCustomer && !matchPhone && !matchSerial && !matchModel && !matchBrand) {
          return false
        }
      }
      return true
    })
  }, [serviceRequests, statusFilter, priorityFilter, categoryFilter, requestTypeFilter, searchQuery])

  // Technician assignment handler
  const handleAssignTicket = async (e) => {
    e.preventDefault()
    if (!selectedTicket) return
    const name = assigneeName.trim()
    if (!name) {
      alert('Please enter or select a technician name.')
      return
    }
    setIsAssigning(true)
    try {
      await assignServiceTicket(selectedTicket.id, name, assignNotes)
      setAssignNotes('')
      alert(`Ticket assigned to ${name} successfully.`)
    } catch (err) {
      alert(`Assignment failed: ${err.message}`)
    } finally {
      setIsAssigning(false)
    }
  }

  // Status transition handler
  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !targetStatus) return
    if (targetStatus === selectedTicket.status) {
      alert('Please choose a different status to transition.')
      return
    }

    if (targetStatus === 'resolved' && !statusReason.trim()) {
      alert('Please provide resolution details when marking a ticket as Resolved.')
      return
    }

    if (targetStatus === 'closed') {
      setIsUpdatingStatus(true)
      try {
        await closeServiceTicket(selectedTicket.id, statusReason.trim() || 'Service request verified and closed.')
        setStatusReason('')
        alert('Ticket closed successfully.')
      } catch (err) {
        alert(`Failed to close ticket: ${err.message}`)
      } finally {
        setIsUpdatingStatus(false)
      }
      return
    }

    setIsUpdatingStatus(true)
    try {
      await updateServiceTicketStatus(selectedTicket.id, targetStatus, statusReason.trim())
      setStatusReason('')
      alert(`Status updated to ${SERVICE_STATUS_META[targetStatus]?.label || targetStatus}.`)
    } catch (err) {
      alert(`Status update failed: ${err.message}`)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Add Part to technical parts list
  const handleAddPart = () => {
    if (!newPartName.trim()) {
      alert('Please enter a component or spare part name.')
      return
    }
    const qty = Math.max(1, parseInt(newPartQty, 10) || 1)
    const price = Math.max(0, parseFloat(newPartPrice) || 0)

    const updatedParts = [
      ...techFormData.parts_used,
      {
        part_name: newPartName.trim(),
        quantity: qty,
        unit_price: price,
        total: qty * price
      }
    ]

    setTechFormData((prev) => ({
      ...prev,
      parts_used: updatedParts
    }))

    setNewPartName('')
    setNewPartQty(1)
    setNewPartPrice(0)
  }

  const handleRemovePart = (index) => {
    setTechFormData((prev) => ({
      ...prev,
      parts_used: prev.parts_used.filter((_, i) => i !== index)
    }))
  }

  // Save Technical Details
  const handleSaveTechDetails = async (e) => {
    e.preventDefault()
    if (!selectedTicket) return
    setIsSavingTech(true)
    try {
      await updateServiceTicketTechnicalDetails(selectedTicket.id, techFormData)
      alert('Technical diagnosis and parts data saved successfully.')
    } catch (err) {
      alert(`Failed to save details: ${err.message}`)
    } finally {
      setIsSavingTech(false)
    }
  }

  // Add Internal Note
  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !newNoteText.trim()) return
    setIsAddingNote(true)
    try {
      await addServiceTicketNote(selectedTicket.id, newNoteText.trim())
      setNewNoteText('')
    } catch (err) {
      alert(`Failed to add note: ${err.message}`)
    } finally {
      setIsAddingNote(false)
    }
  }

  // Reopen Ticket (Superadmin Only)
  const handleConfirmReopen = async (e) => {
    e.preventDefault()
    if (!selectedTicket) return
    const reason = reopenReasonText.trim()
    if (reason.length < 5) {
      alert('Please provide a meaningful reason for reopening this ticket (at least 5 characters).')
      return
    }
    setIsReopening(true)
    try {
      await reopenServiceTicket(selectedTicket.id, reason)
      setShowReopenModal(false)
      setReopenReasonText('')
      alert('Ticket reopened and set back to in-progress status.')
    } catch (err) {
      alert(`Failed to reopen ticket: ${err.message}`)
    } finally {
      setIsReopening(false)
    }
  }

  return (
    <AdminLayout activeTab="service-requests">
      <div className="admin-service-requests-page">
        {/* Header Row */}
        <div className="admin-page-header-row">
          <div className="admin-page-title-group">
            <h2>After-Sales Service &amp; Repair Tickets</h2>
            <p>Track hardware repair requests, CCTV maintenance visits, diagnostic reports, and parts replacement.</p>
          </div>
          <div>
            <button
              type="button"
              className="btn-outline"
              onClick={() => loadAdminServiceRequests()}
              disabled={isLoadingServiceRequests}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              🔄 Refresh List
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="service-requests-stats-row">
          <div
            className={`service-stat-card ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span className="service-stat-label">Total Tickets</span>
            <span className="service-stat-value">{metrics?.serviceRequests?.total ?? 0}</span>
          </div>

          <div
            className={`service-stat-card ${statusFilter === 'new' ? 'active' : ''}`}
            onClick={() => setStatusFilter('new')}
          >
            <span className="service-stat-label" style={{ color: '#0284c7' }}>New Unassigned</span>
            <span className="service-stat-value" style={{ color: '#0284c7' }}>{metrics?.serviceRequests?.newCount ?? 0}</span>
          </div>

          <div
            className={`service-stat-card ${statusFilter === 'assigned' ? 'active' : ''}`}
            onClick={() => setStatusFilter('assigned')}
          >
            <span className="service-stat-label" style={{ color: '#6366f1' }}>Assigned</span>
            <span className="service-stat-value" style={{ color: '#6366f1' }}>{metrics?.serviceRequests?.assigned ?? 0}</span>
          </div>

          <div
            className={`service-stat-card ${statusFilter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
          >
            <span className="service-stat-label" style={{ color: '#d97706' }}>In Progress</span>
            <span className="service-stat-value" style={{ color: '#d97706' }}>{metrics?.serviceRequests?.inProgress ?? 0}</span>
          </div>

          <div
            className={`service-stat-card ${statusFilter === 'waiting_for_parts' ? 'active' : ''}`}
            onClick={() => setStatusFilter('waiting_for_parts')}
          >
            <span className="service-stat-label" style={{ color: '#ea580c' }}>Waiting Parts</span>
            <span className="service-stat-value" style={{ color: '#ea580c' }}>{metrics?.serviceRequests?.waiting ?? 0}</span>
          </div>

          <div
            className={`service-stat-card ${statusFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('resolved')}
          >
            <span className="service-stat-label" style={{ color: '#16a34a' }}>Resolved</span>
            <span className="service-stat-value" style={{ color: '#16a34a' }}>{metrics?.serviceRequests?.resolved ?? 0}</span>
          </div>

          <div
            className={`service-stat-card ${statusFilter === 'closed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('closed')}
          >
            <span className="service-stat-label" style={{ color: '#64748b' }}>Closed</span>
            <span className="service-stat-value" style={{ color: '#64748b' }}>{metrics?.serviceRequests?.closed ?? 0}</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="admin-service-filter-bar">
          <div className="filter-search-box">
            <input
              type="text"
              className="filter-search-input"
              placeholder="🔍 Search ticket #, customer name, mobile, serial #, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-selects-row">
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {Object.entries(SERVICE_STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              {Object.entries(SERVICE_PRIORITY_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={requestTypeFilter}
              onChange={(e) => setRequestTypeFilter(e.target.value)}
            >
              <option value="all">All Request Types</option>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error message */}
        {serviceRequestsError && (
          <div className="service-alert-box error" style={{ margin: '16px 0', padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
            ⚠️ {serviceRequestsError}
          </div>
        )}

        {/* Tickets Table */}
        <div className="service-table-container">
          <table className="service-tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Customer &amp; Mobile</th>
                <th>Product &amp; Issue</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Technician</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingServiceRequests && serviceRequests.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading service tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No service tickets match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const statusMeta = SERVICE_STATUS_META[t.status] || SERVICE_STATUS_META.new
                  const priorityMeta = SERVICE_PRIORITY_META[t.priority] || SERVICE_PRIORITY_META.standard

                  return (
                    <tr key={t.id} onClick={() => handleSelectTicket(t)}>
                      <td>
                        <div className="ticket-cell-id">
                          <span>{t.ticket_number}</span>
                          <button
                            type="button"
                            className="ticket-copy-btn"
                            title="Copy Ticket ID"
                            style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                            onClick={(e) => handleCopyTicket(e, t.ticket_number)}
                          >
                            {copiedId === t.ticket_number ? '✓' : '📋'}
                          </button>
                        </div>
                      </td>

                      <td>
                        <div className="ticket-cell-customer">
                          <span className="customer-name-bold">{t.customer_name}</span>
                          <span className="customer-mobile-sub">📞 {t.mobile_number}</span>
                        </div>
                      </td>

                      <td>
                        <div className="ticket-cell-device">
                          <span className="device-category-tag">{t.product_category}</span>
                          <span className="device-model-sub">
                            {t.brand} {t.model_number ? `(${t.model_number})` : ''}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                          {t.service_location === 'On-site' ? '🏠 On-site' : '🏢 In-shop'}
                        </span>
                      </td>

                      <td>
                        <span
                          className="priority-badge-pill"
                          style={{ background: priorityMeta.bg, color: priorityMeta.color }}
                        >
                          {priorityMeta.label}
                        </span>
                      </td>

                      <td>
                        <span
                          className="status-badge-pill"
                          style={{ background: statusMeta.bg, color: statusMeta.color }}
                        >
                          <span>{statusMeta.icon}</span>
                          <span>{statusMeta.label}</span>
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.84rem', color: t.assigned_to ? '#1e293b' : '#94a3b8', fontWeight: t.assigned_to ? 600 : 400 }}>
                          {t.assigned_to ? `👤 ${t.assigned_to}` : 'Unassigned'}
                        </span>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDateOnly(t.created_at)}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectTicket(t)
                          }}
                        >
                          Manage →
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ticket Drawer Modal */}
        {selectedTicket && (
          <div className="ticket-drawer-backdrop" onClick={() => setSelectedTicketId(null)}>
            <div className="ticket-drawer" onClick={(e) => e.stopPropagation()}>
              {/* Drawer Header */}
              <div className="ticket-drawer-header">
                <div className="drawer-header-left">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ticket-code" style={{ fontSize: '1.2rem' }}>
                        {selectedTicket.ticket_number}
                      </span>
                      <button
                        type="button"
                        className="ticket-copy-btn"
                        onClick={(e) => handleCopyTicket(e, selectedTicket.ticket_number)}
                      >
                        {copiedId === selectedTicket.ticket_number ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Raised on {formatDateTime(selectedTicket.created_at)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Status pill */}
                  <span
                    className="status-badge-pill"
                    style={{
                      background: SERVICE_STATUS_META[selectedTicket.status]?.bg || '#f1f5f9',
                      color: SERVICE_STATUS_META[selectedTicket.status]?.color || '#475569'
                    }}
                  >
                    {SERVICE_STATUS_META[selectedTicket.status]?.icon} {SERVICE_STATUS_META[selectedTicket.status]?.label}
                  </span>

                  <button
                    type="button"
                    className="drawer-close-btn"
                    onClick={() => setSelectedTicketId(null)}
                    title="Close Drawer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Drawer Sub-nav Tabs */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: '#ffffff',
                  padding: '0 24px'
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: activeDrawerTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    fontWeight: activeDrawerTab === 'overview' ? 700 : 500,
                    color: activeDrawerTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveDrawerTab('overview')}
                >
                  📋 Overview &amp; Site
                </button>

                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: activeDrawerTab === 'technical' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    fontWeight: activeDrawerTab === 'technical' ? 700 : 500,
                    color: activeDrawerTab === 'technical' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveDrawerTab('technical')}
                >
                  🛠️ Technical Diagnosis &amp; Parts
                </button>

                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: activeDrawerTab === 'notes' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    fontWeight: activeDrawerTab === 'notes' ? 700 : 500,
                    color: activeDrawerTab === 'notes' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveDrawerTab('notes')}
                >
                  💬 Internal Notes ({selectedTicket.internal_notes?.length || 0})
                </button>

                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: activeDrawerTab === 'timeline' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    fontWeight: activeDrawerTab === 'timeline' ? 700 : 500,
                    color: activeDrawerTab === 'timeline' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveDrawerTab('timeline')}
                >
                  ⏱️ Timeline &amp; Audit
                </button>
              </div>

              {/* Drawer Body */}
              <div className="ticket-drawer-body">
                {/* 1. OVERVIEW TAB */}
                {activeDrawerTab === 'overview' && (
                  <>
                    {/* Status Pipeline & Action Bar */}
                    <div className="drawer-section-card">
                      <h4 className="drawer-section-title">Status Transition &amp; Technician Assignment</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                        {/* Assign Tech Form */}
                        <form onSubmit={handleAssignTicket} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                            Assigned Technician:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Ramesh Kumar (Lead Engineer)"
                            value={assigneeName}
                            onChange={(e) => setAssigneeName(e.target.value)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.88rem'
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Assignment notes / instructions..."
                            value={assignNotes}
                            onChange={(e) => setAssignNotes(e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.82rem'
                            }}
                          />
                          <button
                            type="submit"
                            className="btn-outline"
                            disabled={isAssigning}
                            style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: '0.82rem' }}
                          >
                            {isAssigning ? 'Assigning...' : '💾 Update Assignment'}
                          </button>
                        </form>

                        {/* Status Transition Form */}
                        <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                            Transition Ticket Status:
                          </label>
                          <select
                            value={targetStatus}
                            onChange={(e) => setTargetStatus(e.target.value)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.88rem'
                            }}
                          >
                            {Object.entries(SERVICE_STATUS_META).map(([key, meta]) => (
                              <option key={key} value={key}>
                                {meta.icon} {meta.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Transition comment / reason..."
                            value={statusReason}
                            onChange={(e) => setStatusReason(e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.82rem'
                            }}
                          />
                          <button
                            type="submit"
                            className="btn-primary"
                            disabled={isUpdatingStatus}
                            style={{ alignSelf: 'flex-start', padding: '6px 16px', fontSize: '0.82rem' }}
                          >
                            {isUpdatingStatus ? 'Updating...' : '⚡ Apply Status Change'}
                          </button>
                        </form>
                      </div>

                      {/* Closed / Reopen Notice */}
                      {selectedTicket.status === 'closed' && (
                        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <strong style={{ color: '#475569', fontSize: '0.88rem' }}>🔒 Ticket is Closed</strong>
                              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                Closed by {selectedTicket.closed_by || 'Staff'} on {formatDateTime(selectedTicket.closed_at)}
                              </p>
                            </div>
                            {isSuperadmin ? (
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ padding: '6px 12px', fontSize: '0.82rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                onClick={() => setShowReopenModal(true)}
                              >
                                🔓 Reopen Ticket (Superadmin)
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                (Only superadmin can reopen)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Customer & Site Details Card */}
                    <div className="drawer-section-card">
                      <h4 className="drawer-section-title">Customer &amp; Site Information</h4>
                      <div className="drawer-info-grid">
                        <div className="drawer-info-item">
                          <span>Customer Name</span>
                          <strong>{selectedTicket.customer_name}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Mobile Number</span>
                          <strong>📞 {selectedTicket.mobile_number}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Customer Type</span>
                          <strong>{selectedTicket.customer_type}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Email Address</span>
                          <strong>{selectedTicket.email || '—'}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Service Location</span>
                          <strong>
                            {selectedTicket.service_location === 'On-site' ? '🏠 On-site Visit' : '🏢 In-Shop Carry-in'}
                          </strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Preferred Visit Date</span>
                          <strong>{formatDateOnly(selectedTicket.preferred_visit_date)}</strong>
                        </div>
                        {selectedTicket.site_address && (
                          <div className="drawer-info-item" style={{ gridColumn: 'span 2' }}>
                            <span>Full Site Address</span>
                            <strong>{selectedTicket.site_address}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hardware & Problem Description */}
                    <div className="drawer-section-card">
                      <h4 className="drawer-section-title">Hardware Specifications &amp; Reported Issue</h4>
                      <div className="drawer-info-grid">
                        <div className="drawer-info-item">
                          <span>Product Category</span>
                          <strong>{selectedTicket.product_category}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Brand &amp; Model</span>
                          <strong>{selectedTicket.brand} {selectedTicket.model_number ? `(${selectedTicket.model_number})` : ''}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Serial Number</span>
                          <strong style={{ fontFamily: 'monospace' }}>{selectedTicket.serial_number || '—'}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Invoice / Bill #</span>
                          <strong>{selectedTicket.invoice_number || '—'}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Purchase Date</span>
                          <strong>{formatDateOnly(selectedTicket.purchase_date)}</strong>
                        </div>
                        <div className="drawer-info-item">
                          <span>Warranty Classification</span>
                          <strong style={{ textTransform: 'capitalize' }}>
                            {selectedTicket.warranty_status?.replace('_', ' ') || 'Under Evaluation'}
                          </strong>
                        </div>
                        <div className="drawer-info-item" style={{ gridColumn: 'span 2' }}>
                          <span>Customer Problem Description</span>
                          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                              {selectedTicket.problem_description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Checklists for CCTV / PC */}
                    {(selectedTicket.cctv_camera_count || selectedTicket.issue_camera_offline || selectedTicket.issue_boot_failure || selectedTicket.issue_display) && (
                      <div className="drawer-section-card">
                        <h4 className="drawer-section-title">Category Diagnostic Checklist</h4>
                        
                        {/* CCTV specifics */}
                        {selectedTicket.cctv_camera_count && (
                          <div style={{ marginBottom: '14px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Camera Count:</span>
                            <strong style={{ marginLeft: '6px' }}>{selectedTicket.cctv_camera_count} Cameras</strong>
                            {selectedTicket.cctv_dvr_details && (
                              <span style={{ marginLeft: '12px', fontSize: '0.84rem' }}>
                                DVR/NVR: {selectedTicket.cctv_dvr_details}
                              </span>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {selectedTicket.issue_camera_offline && (
                            <span className="badge-inline highlight">📹 Camera Offline</span>
                          )}
                          {selectedTicket.issue_remote_viewing && (
                            <span className="badge-inline highlight">📱 Mobile App Streaming</span>
                          )}
                          {selectedTicket.issue_recording_playback && (
                            <span className="badge-inline highlight">💾 Playback / HDD Storage</span>
                          )}
                          {selectedTicket.issue_cabling && (
                            <span className="badge-inline highlight">🔌 Cabling / Connectors</span>
                          )}
                          {selectedTicket.issue_power && (
                            <span className="badge-inline highlight">⚡ SMPS / Power Supply</span>
                          )}
                          {selectedTicket.issue_network && (
                            <span className="badge-inline highlight">🌐 IP / Switch Network</span>
                          )}
                          {selectedTicket.issue_boot_failure && (
                            <span className="badge-inline highlight">💻 Boot / No Power</span>
                          )}
                          {selectedTicket.issue_display && (
                            <span className="badge-inline highlight">🖥️ Display / GPU Lines</span>
                          )}
                          {selectedTicket.issue_overheating && (
                            <span className="badge-inline highlight">🔥 Overheating / Fan</span>
                          )}
                          {selectedTicket.issue_slow_performance && (
                            <span className="badge-inline highlight">🐌 Slow Performance</span>
                          )}
                          {selectedTicket.issue_os_software && (
                            <span className="badge-inline highlight">💿 Windows / OS / BSOD</span>
                          )}
                          {selectedTicket.issue_data_recovery && (
                            <span className="badge-inline highlight">💽 Data Recovery</span>
                          )}
                          {selectedTicket.issue_hardware_replacement && (
                            <span className="badge-inline highlight">⚙️ Component Replacement</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Customer Attachment */}
                    {selectedTicket.attachment_url && (
                      <div className="drawer-section-card">
                        <h4 className="drawer-section-title">Customer Attached Photo / Error Screenshot</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.5rem' }}>📎</span>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600 }}>
                              {selectedTicket.attachment_name || 'Service Attachment'}
                            </span>
                            <a
                              href={selectedTicket.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'underline' }}
                            >
                              Open Full-Resolution File ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 2. TECHNICAL & PARTS TAB */}
                {activeDrawerTab === 'technical' && (
                  <form onSubmit={handleSaveTechDetails} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="drawer-section-card">
                      <h4 className="drawer-section-title">Technician Findings &amp; Work Report</h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="service-field-group">
                          <label>Root Cause Diagnosis:</label>
                          <textarea
                            rows="3"
                            placeholder="Detail technician diagnostic testing, fault isolation, multimeter readings..."
                            value={techFormData.diagnosis}
                            onChange={(e) => setTechFormData({ ...techFormData, diagnosis: e.target.value })}
                          />
                        </div>

                        <div className="service-field-group">
                          <label>Work Performed / Corrective Action:</label>
                          <textarea
                            rows="3"
                            placeholder="Detail repairs, thermal paste re-application, solder repairs, camera refocusing..."
                            value={techFormData.work_performed}
                            onChange={(e) => setTechFormData({ ...techFormData, work_performed: e.target.value })}
                          />
                        </div>

                        <div className="service-field-group">
                          <label>Resolution Summary (Presented to Customer):</label>
                          <textarea
                            rows="2"
                            placeholder="Clear summary explaining how the issue was fixed..."
                            value={techFormData.resolution_notes}
                            onChange={(e) => setTechFormData({ ...techFormData, resolution_notes: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                          <div className="service-field-group">
                            <label>Warranty Status:</label>
                            <select
                              value={techFormData.warranty_status}
                              onChange={(e) => setTechFormData({ ...techFormData, warranty_status: e.target.value })}
                            >
                              <option value="under_evaluation">Under Evaluation</option>
                              <option value="in_warranty">In Warranty (Free of Charge)</option>
                              <option value="out_of_warranty">Out of Warranty (Chargeable)</option>
                              <option value="amc_covered">AMC Contract Covered</option>
                            </select>
                          </div>

                          <div className="service-field-group">
                            <label>Estimated Cost (₹):</label>
                            <input
                              type="number"
                              min="0"
                              value={techFormData.estimated_cost}
                              onChange={(e) => setTechFormData({ ...techFormData, estimated_cost: parseFloat(e.target.value) || 0 })}
                            />
                          </div>

                          <div className="service-field-group">
                            <label>Final Cost (₹):</label>
                            <input
                              type="number"
                              min="0"
                              value={techFormData.final_cost}
                              onChange={(e) => setTechFormData({ ...techFormData, final_cost: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Parts Used Table */}
                    <div className="drawer-section-card">
                      <h4 className="drawer-section-title">Spare Parts &amp; Consumables Replaced</h4>

                      {/* Add part row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end', marginBottom: '14px' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Part Name / Model:</label>
                          <input
                            type="text"
                            placeholder="e.g. Kingston NV2 500GB SSD"
                            value={newPartName}
                            onChange={(e) => setNewPartName(e.target.value)}
                            style={{ padding: '7px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.84rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={newPartQty}
                            onChange={(e) => setNewPartQty(parseInt(e.target.value, 10) || 1)}
                            style={{ padding: '7px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.84rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Unit Cost (₹):</label>
                          <input
                            type="number"
                            min="0"
                            value={newPartPrice}
                            onChange={(e) => setNewPartPrice(parseFloat(e.target.value) || 0)}
                            style={{ padding: '7px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.84rem' }}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={handleAddPart}
                            style={{ padding: '7px 12px', fontSize: '0.84rem' }}
                          >
                            + Add Part
                          </button>
                        </div>
                      </div>

                      {/* List of parts */}
                      <table className="parts-table-editor">
                        <thead>
                          <tr>
                            <th>Part / Description</th>
                            <th style={{ width: '60px' }}>Qty</th>
                            <th style={{ width: '90px' }}>Unit (₹)</th>
                            <th style={{ width: '90px' }}>Total (₹)</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {techFormData.parts_used.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                                No spare parts listed for this service ticket.
                              </td>
                            </tr>
                          ) : (
                            techFormData.parts_used.map((part, idx) => (
                              <tr key={idx}>
                                <td><strong>{part.part_name}</strong></td>
                                <td>{part.quantity}</td>
                                <td>₹{part.unit_price?.toLocaleString('en-IN')}</td>
                                <td>₹{(part.total || part.quantity * part.unit_price)?.toLocaleString('en-IN')}</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePart(idx)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                                    title="Remove part"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isSavingTech}
                        style={{ padding: '10px 24px' }}
                      >
                        {isSavingTech ? 'Saving...' : '💾 Save Technical Report & Costs'}
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. INTERNAL NOTES TAB */}
                {activeDrawerTab === 'notes' && (
                  <div className="drawer-section-card">
                    <h4 className="drawer-section-title">Private Internal Collaboration Notes</h4>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px 0' }}>
                      Internal notes are visible ONLY to authorized ARS staff and technicians. Customers never see these notes.
                    </p>

                    {/* Compose note */}
                    <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                      <textarea
                        rows="3"
                        placeholder="Add private note, procurement update, customer callback log..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.88rem'
                        }}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isAddingNote || !newNoteText.trim()}
                        style={{ alignSelf: 'flex-end', padding: '6px 16px', fontSize: '0.84rem' }}
                      >
                        {isAddingNote ? 'Adding...' : 'Post Internal Note'}
                      </button>
                    </form>

                    {/* Notes List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {!selectedTicket.internal_notes || selectedTicket.internal_notes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', background: '#f8fafc', borderRadius: '6px' }}>
                          No internal notes recorded on this ticket yet.
                        </div>
                      ) : (
                        selectedTicket.internal_notes.map((note, idx) => (
                          <div
                            key={note.id || idx}
                            style={{
                              padding: '12px 14px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b' }}>
                                👤 {note.author_name} ({note.author_role || 'Staff'})
                              </span>
                              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                {formatDateTime(note.created_at)}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                              {note.note_text}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. TIMELINE TAB */}
                {activeDrawerTab === 'timeline' && (
                  <div className="drawer-section-card">
                    <h4 className="drawer-section-title">Audit Trail &amp; Activity Log</h4>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px 0' }}>
                      Complete append-only audit trail recording every state change, assignment, diagnostic update, and closure.
                    </p>

                    <div className="activity-timeline">
                      {/* Ticket submission item */}
                      <div className="timeline-entry-row">
                        <div className="timeline-icon-dot" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          📝
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-actor">Customer ({selectedTicket.customer_name})</span>
                            <span className="timeline-time">{formatDateTime(selectedTicket.created_at)}</span>
                          </div>
                          <p className="timeline-msg">
                            Ticket registered via website: {selectedTicket.product_category} — {selectedTicket.request_type}
                          </p>
                        </div>
                      </div>

                      {/* Dynamic activities if stored on ticket */}
                      {Array.isArray(selectedTicket.activities) &&
                        selectedTicket.activities.map((act, i) => (
                          <div key={act.id || i} className="timeline-entry-row">
                            <div className="timeline-icon-dot" style={{ background: '#f1f5f9' }}>
                              ⚙️
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-actor">{act.actor_name} ({act.actor_role})</span>
                                <span className="timeline-time">{formatDateTime(act.created_at)}</span>
                              </div>
                              <p className="timeline-msg">
                                <strong>{act.action_type?.replace(/_/g, ' ')}:</strong> {act.details?.notes || act.details?.reason || JSON.stringify(act.details)}
                              </p>
                            </div>
                          </div>
                        ))}

                      {/* If resolved */}
                      {selectedTicket.resolved_at && (
                        <div className="timeline-entry-row">
                          <div className="timeline-icon-dot" style={{ background: '#dcfce7', color: '#15803d' }}>
                            ✓
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <span className="timeline-actor">Resolved by {selectedTicket.resolved_by || 'Technician'}</span>
                              <span className="timeline-time">{formatDateTime(selectedTicket.resolved_at)}</span>
                            </div>
                            <p className="timeline-msg">
                              {selectedTicket.resolution_notes || 'Service diagnosis & repair complete.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* If closed */}
                      {selectedTicket.closed_at && (
                        <div className="timeline-entry-row">
                          <div className="timeline-icon-dot" style={{ background: '#e2e8f0', color: '#475569' }}>
                            🔒
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <span className="timeline-actor">Closed by {selectedTicket.closed_by || 'Staff'}</span>
                              <span className="timeline-time">{formatDateTime(selectedTicket.closed_at)}</span>
                            </div>
                            <p className="timeline-msg">
                              Ticket marked closed.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reopen Modal (Superadmin) */}
        {showReopenModal && (
          <div className="ticket-drawer-backdrop" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '28px',
                maxWidth: '480px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#b91c1c' }}>
                🔓 Reopen Service Ticket
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
                Superadmin privilege: Reopening this ticket will transition its status back to <strong>In Progress</strong> and append an immutable audit log entry.
              </p>

              <form onSubmit={handleConfirmReopen} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="service-field-group">
                  <label>Mandatory Reopening Justification:</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Customer reported recurrence of camera disconnection after 24 hours..."
                    value={reopenReasonText}
                    onChange={(e) => setReopenReasonText(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowReopenModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isReopening}
                    style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                  >
                    {isReopening ? 'Reopening...' : 'Confirm Reopen Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
