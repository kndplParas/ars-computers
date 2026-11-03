import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ORDER_REGISTER_COLUMNS,
  ORDER_STATUS_QUICK_FILTERS,
  extractOrderRegisterRow
} from '../../utils/liveOrdersRegisterHelper.js'
import {
  exportLiveOrdersRegisterViewToExcel,
  extractOrderSequenceNumber
} from '../../utils/salesReportGenerator.js'
import { MONTH_NAMES } from '../../utils/excelReportGenerator.js'
import './LiveEnquiryRegister.css'

/**
 * ============================================================================
 * ARS Computers — Live Orders Register Modal
 * ============================================================================
 * Advanced Excel-like Live Operational Spreadsheet for Sales Order Management.
 *
 * Features:
 * - 19 Standard Spreadsheet Columns matching Requirement 16.
 * - Global search, lifecycle status quick filter, payment status filter,
 *   payment method filter, employee filter, approval month/year filter.
 * - Frozen Order Reference column, resizable columns, column toggle.
 * - Read-only spreadsheet viewing grid — no arbitrary cell edits.
 * - Export Current View to XLSX via ExcelJS.
 * ============================================================================
 */
export default function LiveOrdersRegisterModal({
  isOpen,
  onClose,
  orders = [],
  onSelectOrder,
  onDeleteOrders,
  onRefresh,
  isLoading = false
}) {
  // --- Search & Filters State ---
  const [globalSearch, setGlobalSearch] = useState('')
  const [statusQuickFilter, setStatusQuickFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [approvalMonth, setApprovalMonth] = useState('all')
  const [approvalYear, setApprovalYear] = useState('all')

  // --- Spreadsheet UI Configuration State ---
  const [density, setDensity] = useState('comfortable')
  const [sortColumn, setSortColumn] = useState('order_ref')
  const [sortDirection, setSortDirection] = useState('asc')
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const map = {}
    ORDER_REGISTER_COLUMNS.forEach((col) => {
      map[col.id] = true
    })
    return map
  })
  const [isColumnsPanelOpen, setIsColumnsPanelOpen] = useState(false)

  // Column widths
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {}
    ORDER_REGISTER_COLUMNS.forEach((col) => {
      map[col.id] = col.defaultWidth
    })
    return map
  })

  // Row selection
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())
  const [toastMessage, setToastMessage] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isColumnsPanelOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, isColumnsPanelOpen])

  // Extract all rows
  const allRows = useMemo(() => {
    return orders.map((o) => extractOrderRegisterRow(o)).filter(Boolean)
  }, [orders])

  // Distinct Filter Option Sets
  const filterOptions = useMemo(() => {
    const employees = new Set()
    const methods = new Set()
    const years = new Set()

    allRows.forEach((r) => {
      if (r.completed_by && r.completed_by !== '—') employees.add(r.completed_by)
      if (r.payment_method && r.payment_method !== '—') methods.add(r.payment_method)
      if (r.raw?.completion_approved_at) {
        const d = new Date(r.raw.completion_approved_at)
        if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
      }
    })

    return {
      employees: Array.from(employees).sort(),
      methods: Array.from(methods).sort(),
      years: Array.from(years).sort((a, b) => b - a)
    }
  }, [allRows])

  // Filter & Search Logic
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // 1. Quick Status Filter
      if (statusQuickFilter !== 'all') {
        if (row.current_status !== statusQuickFilter && row.order_status !== statusQuickFilter) {
          return false
        }
      }

      // 2. Payment Status Filter
      if (paymentStatusFilter !== 'all') {
        if (row.payment_status.toLowerCase() !== paymentStatusFilter.toLowerCase()) {
          return false
        }
      }

      // 3. Payment Method Filter
      if (paymentMethodFilter !== 'all') {
        if (row.payment_method.toLowerCase() !== paymentMethodFilter.toLowerCase()) {
          return false
        }
      }

      // 4. Employee Filter
      if (employeeFilter !== 'all') {
        if (row.completed_by !== employeeFilter) return false
      }

      // 5. Approval Month & Year Filter
      if (approvalMonth !== 'all' || approvalYear !== 'all') {
        if (!row.raw?.completion_approved_at) return false
        const d = new Date(row.raw.completion_approved_at)
        if (Number.isNaN(d.getTime())) return false

        if (approvalMonth !== 'all' && d.getMonth() !== Number(approvalMonth)) {
          return false
        }
        if (approvalYear !== 'all' && d.getFullYear() !== Number(approvalYear)) {
          return false
        }
      }

      // 6. Global Search
      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase()
        const match =
          row.order_ref.toLowerCase().includes(q) ||
          row.customer_name.toLowerCase().includes(q) ||
          row.contact_info.toLowerCase().includes(q) ||
          row.items_summary.toLowerCase().includes(q) ||
          row.completed_by.toLowerCase().includes(q) ||
          row.payment_status.toLowerCase().includes(q) ||
          row.payment_method.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [
    allRows,
    statusQuickFilter,
    paymentStatusFilter,
    paymentMethodFilter,
    employeeFilter,
    approvalMonth,
    approvalYear,
    globalSearch
  ])

  // Sort Logic
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA = a[sortColumn] ?? ''
      let valB = b[sortColumn] ?? ''

      // Numeric comparison
      if (['total_amount', 'paid_amount', 'balance_amount', 'total_quantity'].includes(sortColumn)) {
        valA = Number(valA) || 0
        valB = Number(valB) || 0
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }

      // Order Reference numerical sequence comparison (e.g. ARS-ORD-00001, ARS-ORD-00010)
      if (sortColumn === 'order_ref') {
        const numA = extractOrderSequenceNumber(String(valA))
        const numB = extractOrderSequenceNumber(String(valB))
        if (numA !== numB) {
          return sortDirection === 'asc' ? numA - numB : numB - numA
        }
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredRows, sortColumn, sortDirection])

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, safeCurrentPage, pageSize])

  // Handle Export Current View
  const handleExportView = async () => {
    try {
      setIsExporting(true)
      const rawFiltered = sortedRows.map((r) => r.raw).filter(Boolean)
      const today = new Date().toISOString().split('T')[0]
      const filename = `ARS_Orders_Register_${today}.xlsx`
      await exportLiveOrdersRegisterViewToExcel(rawFiltered, filename)
      showToast(`Exported ${rawFiltered.length} orders to ${filename}`)
    } catch (err) {
      console.error('Export failed:', err)
      showToast('Export failed. Check console for details.')
    } finally {
      setIsExporting(false)
    }
  }

  // Handle Copy Cell
  const handleCopyCell = (text, e) => {
    e.stopPropagation()
    if (!text || text === '—') return
    navigator.clipboard.writeText(String(text))
    showToast(`Copied "${text}" to clipboard`)
  }

  // Column Resizing
  const resizingRef = useRef({ colId: null, startX: 0, startWidth: 0 })
  const handleResizeStart = (colId, e) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = {
      colId,
      startX: e.clientX,
      startWidth: columnWidths[colId] || 120
    }

    const handleMouseMove = (moveEvent) => {
      if (!resizingRef.current.colId) return
      const diff = moveEvent.clientX - resizingRef.current.startX
      const minW = ORDER_REGISTER_COLUMNS.find((c) => c.id === resizingRef.current.colId)?.minWidth || 80
      const newW = Math.max(minW, resizingRef.current.startWidth + diff)
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current.colId]: newW }))
    }

    const handleMouseUp = () => {
      resizingRef.current = { colId: null, startX: 0, startWidth: 0 }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleSort = (colId) => {
    const colDef = ORDER_REGISTER_COLUMNS.find((c) => c.id === colId)
    if (!colDef?.sortable) return

    if (sortColumn === colId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(colId)
      setSortDirection('asc')
    }
  }

  const handleToggleSelectRow = (id, e) => {
    e.stopPropagation()
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleSelectAll = (e) => {
    e.stopPropagation()
    if (paginatedRows.every((r) => selectedRowIds.has(r.id))) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        paginatedRows.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        paginatedRows.forEach((r) => next.add(r.id))
        return next
      })
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedRowIds.size === 0) return
    const count = selectedRowIds.size
    const confirmed = window.confirm(`Are you sure you want to delete / remove ${count} selected order(s) to Bin?`)
    if (!confirmed) return

    if (onDeleteOrders) {
      await onDeleteOrders(Array.from(selectedRowIds))
      setSelectedRowIds(new Set())
      showToast(`Removed ${count} selected order(s) to Bin.`)
    } else {
      showToast(`Delete action unavailable.`)
    }
  }

  const toggleColumn = (colId) => {
    if (colId === 'order_ref') return // Fixed column
    setVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }))
  }

  if (!isOpen) return null

  return (
    <div className="live-register-overlay" role="dialog" aria-modal="true" aria-labelledby="live-register-title" onClick={onClose}>
      <div className="live-register-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="live-register-header">
          <div className="live-register-title-area">
            <h2 id="live-register-title" className="live-register-title">
              📋 Live Orders Register
            </h2>
            <span className="live-register-badge">PostgreSQL Authoritative</span>
            <span className="live-register-count-pill" id="live-register-counts">
              Showing {sortedRows.length} of {allRows.length} Orders
            </span>
          </div>

          <div className="live-register-actions-top">
            <button
              type="button"
              className="live-register-btn"
              style={{
                background: selectedRowIds.size > 0 ? '#dc2626' : '#f1f5f9',
                color: selectedRowIds.size > 0 ? '#ffffff' : '#94a3b8',
                borderColor: selectedRowIds.size > 0 ? '#b91c1c' : '#cbd5e1',
                cursor: selectedRowIds.size > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
              onClick={handleDeleteSelected}
              disabled={selectedRowIds.size === 0}
              title={selectedRowIds.size > 0 ? `Delete ${selectedRowIds.size} selected order(s) to Bin` : 'Select orders using checkboxes to delete'}
            >
              🗑️ Delete Selected {selectedRowIds.size > 0 ? `(${selectedRowIds.size})` : ''}
            </button>

            <button
              type="button"
              id="export-current-view-btn"
              className="live-register-btn live-register-btn-export"
              onClick={handleExportView}
              disabled={isExporting}
            >
              {isExporting ? 'Generating...' : '📥 Export Current View'}
            </button>

            <button
              type="button"
              id="live-register-refresh-btn"
              className="live-register-btn live-register-btn-refresh"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh register from database"
            >
              {isLoading ? 'Loading...' : '🔄 Refresh'}
            </button>

            <button
              type="button"
              id="live-register-close-btn"
              className="live-register-btn live-register-btn-close"
              onClick={onClose}
              aria-label="Close live register"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbars & Filter Controls */}
        <div className="live-register-toolbars">
          {/* Row 1: Global Search & Quick Status Filter Chips & Density/Columns */}
          <div className="live-register-row-top">
            <div className="live-register-search-wrap">
              <span className="live-register-search-icon">🔍</span>
              <input
                id="register-search-input"
                type="text"
                className="live-register-search-input"
                placeholder="Search reference, customer, item, payment..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              {globalSearch && (
                <button
                  type="button"
                  className="live-register-search-clear"
                  onClick={() => setGlobalSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="live-register-status-chips" id="status-quick-filters">
              {ORDER_STATUS_QUICK_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`live-register-chip ${statusQuickFilter === f.id ? 'active' : ''}`}
                  onClick={() => setStatusQuickFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Density Toggle */}
              <div className="live-register-filter-group">
                <span className="live-register-filter-label">Density:</span>
                <select
                  className="live-register-select"
                  value={density}
                  onChange={(e) => setDensity(e.target.value)}
                  title="Table row spacing"
                >
                  <option value="comfortable">Spacious</option>
                  <option value="compact">Compact</option>
                </select>
              </div>

              {/* Columns Selector Popover */}
              <div className="live-register-columns-dropdown-wrap">
                <button
                  type="button"
                  id="columns-toggle-btn"
                  className="live-register-btn-secondary"
                  onClick={() => setIsColumnsPanelOpen(!isColumnsPanelOpen)}
                >
                  ⚙️ Columns ({ORDER_REGISTER_COLUMNS.filter((c) => visibleColumns[c.id]).length})
                </button>

                {isColumnsPanelOpen && (
                  <div className="live-register-columns-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e293b' }}>Show / Hide Columns</span>
                      <button
                        type="button"
                        onClick={() => setIsColumnsPanelOpen(false)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕
                      </button>
                    </div>
                    {ORDER_REGISTER_COLUMNS.map((col) => (
                      <label key={col.id} className="live-register-column-item">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.id]}
                          disabled={col.id === 'order_ref'}
                          onChange={() => toggleColumn(col.id)}
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Secondary Dropdown Multi-filters */}
          <div className="live-register-row-secondary">
            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Payment:</span>
              <select
                className="live-register-select"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                title="Filter by payment status"
              >
                <option value="all">All Payment Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Received</option>
              </select>
            </div>

            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Method:</span>
              <select
                className="live-register-select"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                title="Filter by payment method"
              >
                <option value="all">All Payment Methods</option>
                {filterOptions.methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Staff:</span>
              <select
                className="live-register-select"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                title="Filter by completed staff"
              >
                <option value="all">All Completed Staff</option>
                {filterOptions.employees.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>
            </div>

            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Month:</span>
              <select
                className="live-register-select"
                value={approvalMonth}
                onChange={(e) => setApprovalMonth(e.target.value)}
                title="Filter by approval month"
              >
                <option value="all">All Approval Months</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Year:</span>
              <select
                className="live-register-select"
                value={approvalYear}
                onChange={(e) => setApprovalYear(e.target.value)}
                title="Filter by approval year"
              >
                <option value="all">All Years</option>
                {filterOptions.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Spreadsheet Table Viewport */}
        <div className={`live-register-viewport ${density}`}>
          <table className={`live-register-table ${density}`}>
            <thead>
              <tr>
                <th
                  className="live-register-th live-register-th-sticky-check"
                  style={{ width: '44px', minWidth: '44px', maxWidth: '44px', textAlign: 'center' }}
                >
                  <input
                    type="checkbox"
                    aria-label="Select all orders on this page"
                    checked={paginatedRows.length > 0 && paginatedRows.every((r) => selectedRowIds.has(r.id))}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                {ORDER_REGISTER_COLUMNS.filter((col) => visibleColumns[col.id]).map((col) => (
                  <th
                    key={col.id}
                    style={{
                      width: columnWidths[col.id],
                      minWidth: col.minWidth
                    }}
                    className={`live-register-th ${col.fixed ? 'live-register-th-sticky-ref' : ''} ${col.sortable ? 'live-register-th-clickable' : ''} ${sortColumn === col.id ? 'sorted' : ''}`}
                    onClick={() => handleSort(col.id)}
                  >
                    <div className="live-register-th-content">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="live-register-sort-indicator">
                          {sortColumn === col.id ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </div>
                    <div
                      className="live-register-col-resizer"
                      onMouseDown={(e) => handleResizeStart(col.id, e)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={ORDER_REGISTER_COLUMNS.filter((c) => visibleColumns[c.id]).length + 1}
                    className="live-register-empty"
                  >
                    No sales orders match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`live-register-tr ${idx % 2 === 1 ? 'zebra' : ''} ${selectedRowIds.has(row.id) ? 'selected' : ''}`}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        setSelectedRowIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(row.id)) next.delete(row.id)
                          else next.add(row.id)
                          return next
                        })
                        return
                      }
                      if (onSelectOrder) onSelectOrder(row.raw)
                    }}
                  >
                    <td
                      className="live-register-td live-register-td-sticky-check"
                      style={{ width: '44px', minWidth: '44px', maxWidth: '44px', textAlign: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select order ${row.order_ref}`}
                        checked={selectedRowIds.has(row.id)}
                        onChange={(e) => handleToggleSelectRow(row.id, e)}
                      />
                    </td>
                    <td
                          className="live-register-td live-register-td-sticky-check"
                          style={{ width: '44px', minWidth: '44px', maxWidth: '44px', textAlign: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select order ${row.order_ref}`}
                            checked={selectedRowIds.has(row.id)}
                            onChange={(e) => handleToggleSelectRow(row.id, e)}
                          />
                        </td>
                        {ORDER_REGISTER_COLUMNS.filter((c) => visibleColumns[c.id]).map((col) => {
                      const val = row[col.id]
                      const isRef = col.id === 'order_ref'
                      const isAmount = ['total_amount', 'paid_amount', 'balance_amount'].includes(col.id)

                      return (
                        <td
                          key={col.id}
                          className={`live-register-td ${col.fixed ? 'live-register-td-sticky-ref' : ''} ${isAmount ? 'align-right' : ''}`}
                          onDoubleClick={(e) => handleCopyCell(val, e)}
                          title="Double-click to copy cell value"
                        >
                          <div className="live-register-cell-content">
                            <span className="live-register-cell-text">
                              {isRef ? (
                                <span style={{ fontWeight: 700, color: '#1e40af' }}>{val}</span>
                              ) : col.id === 'payment_status' ? (
                                <span
                                  className={`live-register-status-badge ${
                                    val === 'PAID' || val === 'RECEIVED' ? 'status-paid' : val === 'PARTIAL' ? 'status-partial' : 'status-pending'
                                  }`}
                                  style={{
                                    backgroundColor: val === 'PAID' || val === 'RECEIVED' ? '#dcfce7' : val === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                                    color: val === 'PAID' || val === 'RECEIVED' ? '#15803d' : val === 'PARTIAL' ? '#b45309' : '#b91c1c'
                                  }}
                                >
                                  {val === 'PAID' ? 'RECEIVED' : val}
                                </span>
                              ) : col.id === 'order_status' ? (
                                <span className={`live-register-status-badge status-${val}`}>
                                  {val}
                                </span>
                              ) : isAmount ? (
                                <span style={{ fontWeight: 600 }}>₹{val}</span>
                              ) : (
                                val
                              )}
                            </span>
                            <button
                              type="button"
                              className="live-register-copy-btn"
                              onClick={(e) => handleCopyCell(val, e)}
                              title="Copy cell value"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="live-register-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              Page {safeCurrentPage} of {totalPages} ({sortedRows.length} filtered records)
            </span>
            <select
              className="live-register-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="live-register-pagination-controls">
            <button
              type="button"
              className="live-register-page-btn"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              ◀ Previous
            </button>
            <button
              type="button"
              className="live-register-page-btn"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next ▶
            </button>
          </div>
        </div>

        {/* Toast */}
        {toastMessage && <div className="live-register-toast">{toastMessage}</div>}
      </div>
    </div>
  )
}
