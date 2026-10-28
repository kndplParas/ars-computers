/**
 * ============================================================================
 * ARS Computers — Live Enquiry Register Modal
 * ============================================================================
 * Advanced Excel-like Live Operational Spreadsheet for Daily Enquiry Management.
 *
 * Core Principles:
 * 1. Supabase/PostgreSQL is the single authoritative source of truth.
 * 2. 18 Standard Excel-like Columns with formatting and '—' for missing values.
 * 3. Read-only spreadsheet viewing grid — no arbitrary cell edits or pastes.
 * 4. Workflow mutations reuse existing secure RPCs via enquiry details drawer.
 * 5. Interactive features: Sorting, Global Search, Status Quick Filters,
 *    Employee/Product/Date Filters, Column Resizing, Column Show/Hide,
 *    Sticky Header & Frozen Reference Column, Row Selection, Copy Values,
 *    and Export Current View to XLSX (ARS_Enquiry_Register_YYYY-MM-DD.xlsx).
 * ============================================================================
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  exportLiveRegisterViewToExcel,
  MONTH_NAMES
} from '../../utils/excelReportGenerator'
import {
  REGISTER_COLUMNS,
  STATUS_QUICK_FILTERS,
  extractRegisterRow
} from '../../utils/liveRegisterHelper'
import './LiveEnquiryRegister.css'

export default function LiveEnquiryRegisterModal({
  isOpen,
  onClose,
  enquiries = [],
  onSelectEnquiry,
  onRefresh,
  isLoading = false,
  adminUser = null
}) {
  // --- Search & Filters State ---
  const [globalSearch, setGlobalSearch] = useState('')
  const [statusQuickFilter, setStatusQuickFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [receivedDateFrom, setReceivedDateFrom] = useState('')
  const [receivedDateTo, setReceivedDateTo] = useState('')
  const [approvalMonth, setApprovalMonth] = useState('all')
  const [approvalYear, setApprovalYear] = useState('all')
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('all')

  // --- Spreadsheet UI Configuration State ---
  const [density, setDensity] = useState('comfortable') // 'compact' | 'comfortable'
  const [sortColumn, setSortColumn] = useState('received_date')
  const [sortDirection, setSortDirection] = useState('desc') // 'asc' | 'desc'
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  // Column visibility state: object mapping colId -> boolean
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const map = {}
    REGISTER_COLUMNS.forEach((col) => {
      map[col.id] = true
    })
    return map
  })
  const [isColumnsPanelOpen, setIsColumnsPanelOpen] = useState(false)

  // Column widths state: object mapping colId -> width in px
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {}
    REGISTER_COLUMNS.forEach((col) => {
      map[col.id] = col.defaultWidth
    })
    return map
  })

  // Row selection state: Set of enquiry IDs
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())

  // Notification / Toast states
  const [copyToast, setCopyToast] = useState(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date().toLocaleTimeString())
  const [isExportingView, setIsExportingView] = useState(false)

  const columnsDropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Handle Escape key to close modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        if (isColumnsPanelOpen) {
          setIsColumnsPanelOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isColumnsPanelOpen, onClose])

  // Close columns dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(e.target)) {
        setIsColumnsPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Dynamic Option Lists ---
  // Extract distinct employees from stored completion identities
  const employeeOptions = useMemo(() => {
    const map = new Map()
    enquiries.forEach((enq) => {
      if (enq.completed_by_name) {
        const key = enq.completed_by_name.trim()
        const code = enq.completed_by_employee_code ? enq.completed_by_employee_code.trim() : null
        if (!map.has(key)) {
          map.set(key, { name: key, code })
        }
      }
    })
    return Array.from(map.values())
  }, [enquiries])

  // Extract distinct products/services
  const productOptions = useMemo(() => {
    const set = new Set()
    enquiries.forEach((enq) => {
      const p = enq.service_requested || enq.category_label || enq.category_interest
      if (p) set.add(p.trim())
    })
    return Array.from(set).sort()
  }, [enquiries])

  // Extract distinct approval years
  const approvalYearOptions = useMemo(() => {
    const set = new Set()
    enquiries.forEach((enq) => {
      if (enq.completion_approved_at) {
        const y = new Date(enq.completion_approved_at).getFullYear()
        if (!Number.isNaN(y)) set.add(y)
      }
    })
    if (set.size === 0) {
      set.add(2026)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [enquiries])

  // --- Raw Data Transformation to Register Rows ---
  const allRows = useMemo(() => {
    return enquiries.map(extractRegisterRow).filter(Boolean)
  }, [enquiries])

  // --- Multi-Criteria Filtering ---
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      const enq = row.raw

      // 1. Global Search (Case-insensitive)
      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase().trim()
        const match =
          row.enquiry_ref.toLowerCase().includes(q) ||
          row.customer_name.toLowerCase().includes(q) ||
          row.contact_info.toLowerCase().includes(q) ||
          row.product_service.toLowerCase().includes(q) ||
          row.enquiry_problem.toLowerCase().includes(q) ||
          row.completed_by.toLowerCase().includes(q) ||
          row.completed_by_code.toLowerCase().includes(q) ||
          row.approved_by.toLowerCase().includes(q) ||
          row.employee_remarks.toLowerCase().includes(q) ||
          row.head_remarks.toLowerCase().includes(q)

        if (!match) return false
      }

      // 2. Status Quick Filter
      if (statusQuickFilter !== 'all') {
        if (statusQuickFilter === 'completed') {
          if (row.current_status !== 'completed' && !enq.is_archived) return false
        } else if (row.current_status !== statusQuickFilter) {
          return false
        }
      }

      // 3. Employee Filter
      if (employeeFilter !== 'all') {
        if (row.completed_by !== employeeFilter) return false
      }

      // 4. Product / Service Filter
      if (productFilter !== 'all') {
        if (row.product_service !== productFilter) return false
      }

      // 5. Received Date Range Filter
      if (receivedDateFrom) {
        if (row.received_date === '—' || row.received_date < receivedDateFrom) {
          return false
        }
      }
      if (receivedDateTo) {
        if (row.received_date === '—' || row.received_date > receivedDateTo) {
          return false
        }
      }

      // 6. Approval Month/Year Filter (Strictly uses completion_approved_at)
      if (approvalMonth !== 'all' || approvalYear !== 'all') {
        if (!enq.completion_approved_at) return false
        const appDate = new Date(enq.completion_approved_at)
        if (Number.isNaN(appDate.getTime())) return false

        if (approvalMonth !== 'all' && appDate.getMonth() !== Number(approvalMonth)) {
          return false
        }
        if (approvalYear !== 'all' && appDate.getFullYear() !== Number(approvalYear)) {
          return false
        }
      }

      // 7. Archive Status Filter
      if (archiveStatusFilter !== 'all') {
        if (row.archive_status !== archiveStatusFilter) return false
      }

      return true
    })
  }, [
    allRows,
    globalSearch,
    statusQuickFilter,
    employeeFilter,
    productFilter,
    receivedDateFrom,
    receivedDateTo,
    approvalMonth,
    approvalYear,
    archiveStatusFilter
  ])

  // --- Sorting ---
  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredRows

    return [...filteredRows].sort((a, b) => {
      const valA = a[sortColumn]
      const valB = b[sortColumn]

      // Handle missing '—' values (push to end)
      if (valA === '—' && valB !== '—') return 1
      if (valB === '—' && valA !== '—') return -1
      if (valA === '—' && valB === '—') return 0

      // String comparison
      const cmp = String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: 'base'
      })

      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortColumn, sortDirection])

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, safeCurrentPage, pageSize])

  // Filter setters that also reset page to 1
  const updateGlobalSearch = (val) => {
    setGlobalSearch(val)
    setCurrentPage(1)
  }
  const updateStatusQuickFilter = (val) => {
    setStatusQuickFilter(val)
    setCurrentPage(1)
  }
  const updateEmployeeFilter = (val) => {
    setEmployeeFilter(val)
    setCurrentPage(1)
  }
  const updateProductFilter = (val) => {
    setProductFilter(val)
    setCurrentPage(1)
  }
  const updateReceivedDateFrom = (val) => {
    setReceivedDateFrom(val)
    setCurrentPage(1)
  }
  const updateReceivedDateTo = (val) => {
    setReceivedDateTo(val)
    setCurrentPage(1)
  }
  const updateApprovalMonth = (val) => {
    setApprovalMonth(val)
    setCurrentPage(1)
  }
  const updateApprovalYear = (val) => {
    setApprovalYear(val)
    setCurrentPage(1)
  }
  const updateArchiveStatusFilter = (val) => {
    setArchiveStatusFilter(val)
    setCurrentPage(1)
  }

  // --- Sort Handler ---
  const handleSort = (colId) => {
    const colDef = REGISTER_COLUMNS.find((c) => c.id === colId)
    if (!colDef || !colDef.sortable) return

    if (sortColumn === colId) {
      if (sortDirection === 'asc') setSortDirection('desc')
      else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(colId)
      setSortDirection('asc')
    }
  }

  // --- Column Resizing Handler ---
  const resizingRef = useRef({ colId: null, startX: 0, startWidth: 0 })

  const handleMouseDownResize = (colId, e) => {
    e.preventDefault()
    e.stopPropagation()
    const startWidth = columnWidths[colId] || 150
    resizingRef.current = { colId, startX: e.clientX, startWidth }

    const handleMouseMove = (moveEvent) => {
      const { colId: activeColId, startX, startWidth: initialWidth } = resizingRef.current
      if (!activeColId) return
      const diff = moveEvent.clientX - startX
      const colDef = REGISTER_COLUMNS.find((c) => c.id === activeColId)
      const minW = colDef?.minWidth || 80
      const newWidth = Math.max(minW, initialWidth + diff)

      setColumnWidths((prev) => ({
        ...prev,
        [activeColId]: newWidth
      }))
    }

    const handleMouseUp = () => {
      resizingRef.current = { colId: null, startX: 0, startWidth: 0 }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Reset column widths to default
  const handleResetColumnWidths = () => {
    const map = {}
    REGISTER_COLUMNS.forEach((col) => {
      map[col.id] = col.defaultWidth
    })
    setColumnWidths(map)
  }

  // Reset all filters
  const handleResetFilters = () => {
    setGlobalSearch('')
    setStatusQuickFilter('all')
    setEmployeeFilter('all')
    setProductFilter('all')
    setReceivedDateFrom('')
    setReceivedDateTo('')
    setApprovalMonth('all')
    setApprovalYear('all')
    setArchiveStatusFilter('all')
    setSortColumn('received_date')
    setSortDirection('desc')
    setCurrentPage(1)
  }

  // Toggle column visibility (Enquiry Reference cannot be hidden)
  const handleToggleColumn = (colId) => {
    if (colId === 'enquiry_ref') return
    setVisibleColumns((prev) => ({
      ...prev,
      [colId]: !prev[colId]
    }))
  }

  // Show all columns
  const handleShowAllColumns = () => {
    const map = {}
    REGISTER_COLUMNS.forEach((col) => {
      map[col.id] = true
    })
    setVisibleColumns(map)
  }

  // --- Row Selection Handlers ---
  const handleToggleSelectRow = (id, e) => {
    e.stopPropagation()
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAllVisibleSelected =
    paginatedRows.length > 0 && paginatedRows.every((r) => selectedRowIds.has(r.id))

  const handleToggleSelectAllVisible = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (isAllVisibleSelected) {
        paginatedRows.forEach((r) => next.delete(r.id))
      } else {
        paginatedRows.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedRowIds(new Set())
  }

  // --- Copy Cell Value Handler ---
  const handleCopyCell = (text, e) => {
    e.stopPropagation()
    if (!text || text === '—') return

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    const truncated = text.length > 25 ? `${text.substring(0, 25)}...` : text
    setCopyToast(`Copied: "${truncated}"`)
    setTimeout(() => setCopyToast(null), 2000)
  }

  // --- Export Current Filtered View Handler ---
  const handleExportCurrentView = async () => {
    setIsExportingView(true)
    try {
      const rawRecords = filteredRows.map((r) => r.raw)
      const res = await exportLiveRegisterViewToExcel(rawRecords, {
        exportedBy: adminUser?.email || 'Authorized Staff'
      })
      setCopyToast(`Exported ${res.count} records: ${res.filename} ✓`)
      setTimeout(() => setCopyToast(null), 3500)
    } catch (err) {
      setCopyToast(`Export failed: ${err.message}`)
      setTimeout(() => setCopyToast(null), 3500)
    } finally {
      setIsExportingView(false)
    }
  }

  // --- Manual Refresh Handler ---
  const handleManualRefresh = async () => {
    if (onRefresh) {
      await onRefresh()
      setLastRefreshedAt(new Date().toLocaleTimeString())
    }
  }

  if (!isOpen) return null

  return (
    <div className="live-register-overlay" role="dialog" aria-modal="true" aria-labelledby="live-register-title">
      <div className="live-register-modal">
        {/* Modal Top Header Bar */}
        <div className="live-register-header">
          <div className="live-register-title-area">
            <h2 id="live-register-title" className="live-register-title">
              📋 Live Enquiry Register
            </h2>
            <span className="live-register-badge">PostgreSQL Authoritative</span>
            <span className="live-register-count-pill" id="live-register-counts">
              {allRows.length} Total | {filteredRows.length} Filtered | {selectedRowIds.size} Selected
            </span>
          </div>

          <div className="live-register-actions-top">
            <button
              type="button"
              id="export-current-view-btn"
              className="live-register-btn live-register-btn-export"
              onClick={handleExportCurrentView}
              disabled={isExportingView}
              title="Export the currently filtered enquiry dataset to XLSX"
            >
              {isExportingView ? 'Exporting...' : '📥 Export Current View'}
            </button>

            <button
              type="button"
              id="live-register-refresh-btn"
              className="live-register-btn live-register-btn-refresh"
              onClick={handleManualRefresh}
              disabled={isLoading}
              title={`Last refreshed at ${lastRefreshedAt}`}
            >
              {isLoading ? 'Refreshing...' : '🔄 Refresh'}
            </button>

            <button
              type="button"
              id="live-register-close-btn"
              className="live-register-btn live-register-btn-close"
              onClick={onClose}
              title="Close Live Enquiry Register"
              aria-label="Close register modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbars Container */}
        <div className="live-register-toolbars">
          {/* Row 1: Global Search & Quick Status Filter Chips */}
          <div className="live-register-row-top">
            <div className="live-register-search-wrap">
              <span className="live-register-search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                id="live-register-search-input"
                className="live-register-search-input"
                placeholder="Search reference, customer, contact, product, remarks, staff..."
                value={globalSearch}
                onChange={(e) => updateGlobalSearch(e.target.value)}
              />
              {globalSearch && (
                <button
                  type="button"
                  className="live-register-search-clear"
                  onClick={() => updateGlobalSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="live-register-status-chips" id="status-quick-filters">
              {STATUS_QUICK_FILTERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`live-register-chip ${statusQuickFilter === s.id ? 'active' : ''}`}
                  onClick={() => updateStatusQuickFilter(s.id)}
                >
                  {s.label}
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
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>

              {/* Columns Selector */}
              <div className="live-register-columns-dropdown-wrap" ref={columnsDropdownRef}>
                <button
                  type="button"
                  id="columns-toggle-btn"
                  className="live-register-btn-secondary"
                  onClick={() => setIsColumnsPanelOpen((prev) => !prev)}
                >
                  ⚙️ Columns ({REGISTER_COLUMNS.filter((c) => visibleColumns[c.id]).length})
                </button>

                {isColumnsPanelOpen && (
                  <div className="live-register-columns-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Show / Hide Columns</span>
                      <button
                        type="button"
                        onClick={handleShowAllColumns}
                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        Select All
                      </button>
                    </div>
                    {REGISTER_COLUMNS.map((col) => (
                      <label key={col.id} className="live-register-column-item">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.id]}
                          disabled={col.id === 'enquiry_ref'}
                          onChange={() => handleToggleColumn(col.id)}
                        />
                        <span style={{ color: col.id === 'enquiry_ref' ? '#64748b' : undefined }}>
                          {col.label} {col.id === 'enquiry_ref' ? '(Fixed)' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Secondary Advanced Filters */}
          <div className="live-register-row-secondary">
            {/* Employee Filter */}
            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Employee:</span>
              <select
                id="filter-employee-select"
                className="live-register-select"
                value={employeeFilter}
                onChange={(e) => updateEmployeeFilter(e.target.value)}
              >
                <option value="all">All Employees</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.name} value={emp.name}>
                    {emp.code ? `${emp.code} — ${emp.name}` : emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product / Service Filter */}
            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Product/Service:</span>
              <select
                id="filter-product-select"
                className="live-register-select"
                value={productFilter}
                onChange={(e) => updateProductFilter(e.target.value)}
              >
                <option value="all">All Products/Services</option>
                {productOptions.map((prod) => (
                  <option key={prod} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
            </div>

            {/* Received Date Range */}
            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Received:</span>
              <input
                type="date"
                className="live-register-date-input"
                value={receivedDateFrom}
                onChange={(e) => updateReceivedDateFrom(e.target.value)}
                title="Received Date From"
              />
              <span style={{ color: '#94a3b8' }}>to</span>
              <input
                type="date"
                className="live-register-date-input"
                value={receivedDateTo}
                onChange={(e) => updateReceivedDateTo(e.target.value)}
                title="Received Date To"
              />
            </div>

            {/* Approval Month / Year Filter (Strictly completion_approved_at) */}
            <div className="live-register-filter-group" title="Filter completed records strictly by approval month & year (completion_approved_at)">
              <span className="live-register-filter-label">Approval Month:</span>
              <select
                id="filter-approval-month-select"
                className="live-register-select"
                value={approvalMonth}
                onChange={(e) => updateApprovalMonth(e.target.value)}
              >
                <option value="all">All Months</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                id="filter-approval-year-select"
                className="live-register-select"
                value={approvalYear}
                onChange={(e) => updateApprovalYear(e.target.value)}
              >
                <option value="all">All Years</option>
                {approvalYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Archive Status Filter */}
            <div className="live-register-filter-group">
              <span className="live-register-filter-label">Archive:</span>
              <select
                id="filter-archive-status-select"
                className="live-register-select"
                value={archiveStatusFilter}
                onChange={(e) => updateArchiveStatusFilter(e.target.value)}
              >
                <option value="all">All Archive States</option>
                <option value="Active">Active</option>
                <option value="Permanently Archived">Permanently Archived</option>
                <option value="In Bin">In Bin</option>
              </select>
            </div>

            {/* Convenience Actions: Reset Filters & Reset Column Widths */}
            <button
              type="button"
              className="live-register-btn-secondary"
              onClick={handleResetFilters}
              title="Reset all search queries and filters to defaults"
            >
              🔄 Reset Filters
            </button>

            <button
              type="button"
              className="live-register-btn-secondary"
              onClick={handleResetColumnWidths}
              title="Reset column widths to initial spreadsheet sizes"
            >
              📏 Reset Widths
            </button>

            {selectedRowIds.size > 0 && (
              <button
                type="button"
                className="live-register-btn-secondary"
                onClick={handleClearSelection}
                style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
              >
                Clear Selection ({selectedRowIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Main Spreadsheet Grid Container */}
        <div className="live-register-grid-container" id="live-register-scroll-area">
          <table className={`live-register-table ${density}`}>
            <thead>
              <tr>
                {/* 1. Selection Checkbox Column (Sticky Left 0px) */}
                <th className="live-register-th live-register-th-sticky-check">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    title="Select all visible rows on this page"
                    aria-label="Select all visible rows"
                  />
                </th>

                {/* 2. Registered Data Columns */}
                {REGISTER_COLUMNS.map((col) => {
                  if (!visibleColumns[col.id]) return null

                  const isStickyRef = col.id === 'enquiry_ref'
                  const thClass = isStickyRef
                    ? 'live-register-th live-register-th-sticky-ref'
                    : 'live-register-th'

                  const width = columnWidths[col.id] || col.defaultWidth
                  const isSorted = sortColumn === col.id

                  return (
                    <th
                      key={col.id}
                      className={thClass}
                      style={{ width: `${width}px`, minWidth: `${col.minWidth}px` }}
                    >
                      <div
                        className={`live-register-th-content ${col.sortable ? 'live-register-th-clickable' : ''}`}
                        onClick={() => col.sortable && handleSort(col.id)}
                        title={col.sortable ? `Click to sort by ${col.label}` : col.label}
                      >
                        <span>{col.label}</span>
                        {col.sortable && (
                          <span className="live-register-sort-indicator">
                            {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        )}
                      </div>

                      {/* Interactive Column Resize Handle */}
                      <div
                        className="live-register-col-resizer"
                        onMouseDown={(e) => handleMouseDownResize(col.id, e)}
                        title="Drag to resize column"
                      />
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={REGISTER_COLUMNS.filter((c) => visibleColumns[c.id]).length + 1}
                    className="live-register-empty"
                  >
                    No enquiries match the current filter or search criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => {
                  const isSelected = selectedRowIds.has(row.id)
                  const isZebra = index % 2 === 1

                  return (
                    <tr
                      key={row.id}
                      className={`live-register-tr ${isZebra ? 'zebra' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectEnquiry && onSelectEnquiry(row.raw)}
                      title="Click row to open authoritative Enquiry Details & History drawer"
                    >
                      {/* Selection Checkbox */}
                      <td
                        className="live-register-td live-register-td-sticky-check"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectRow(row.id, e)}
                          aria-label={`Select row ${row.enquiry_ref}`}
                        />
                      </td>

                      {/* Columns */}
                      {REGISTER_COLUMNS.map((col) => {
                        if (!visibleColumns[col.id]) return null

                        const isStickyRef = col.id === 'enquiry_ref'
                        const tdClass = isStickyRef
                          ? 'live-register-td live-register-td-sticky-ref'
                          : 'live-register-td'

                        const cellValue = row[col.id] || '—'

                        return (
                          <td
                            key={col.id}
                            className={tdClass}
                            style={{
                              width: `${columnWidths[col.id] || col.defaultWidth}px`,
                              maxWidth: `${columnWidths[col.id] || col.defaultWidth}px`
                            }}
                            title={String(cellValue)}
                          >
                            <div className="live-register-cell-content">
                              {col.id === 'current_status' ? (
                                <span className={`live-register-status-badge status-${cellValue}`}>
                                  {cellValue}
                                </span>
                              ) : col.id === 'archive_status' ? (
                                <span
                                  className={`live-register-archive-badge ${
                                    cellValue === 'Permanently Archived'
                                      ? 'archived'
                                      : cellValue === 'In Bin'
                                        ? 'bin'
                                        : 'active'
                                  }`}
                                >
                                  {cellValue}
                                </span>
                              ) : (
                                <span className="live-register-cell-text">{cellValue}</span>
                              )}

                              {cellValue !== '—' && (
                                <button
                                  type="button"
                                  className="live-register-copy-btn"
                                  onClick={(e) => handleCopyCell(String(cellValue), e)}
                                  title={`Copy "${cellValue}" to clipboard`}
                                  aria-label="Copy cell value"
                                >
                                  📋
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Bar */}
        <div className="live-register-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>
              Showing {sortedRows.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(safeCurrentPage * pageSize, sortedRows.length)} of {sortedRows.length} records
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page:</span>
              <select
                id="live-register-pagesize-select"
                className="live-register-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="live-register-pagination-controls">
            <button
              type="button"
              className="live-register-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
            >
              ◀ Previous
            </button>

            <span style={{ fontWeight: 600, padding: '0 8px' }}>
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="live-register-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>

      {/* Copy Feedback Toast */}
      {copyToast && (
        <div className="live-register-copy-toast" role="status">
          <span>✓</span>
          <span>{copyToast}</span>
        </div>
      )}
    </div>
  )
}
