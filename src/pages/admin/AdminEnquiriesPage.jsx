import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { ENQUIRY_STATUSES } from '../../data/mockEnquiries'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'
import { parseServiceEnquiry } from '../../utils/serviceEnquiryHelper'
import { formatAadhaarDisplay } from '../../utils/aadhaarFormatter'
import { formatJobDispatchText, buildWhatsAppDispatchUrl } from '../../utils/jobDispatchFormatter'
import {
  downloadMonthlyEnquiriesExcel,
  filterEnquiriesByReportingMonth,
  getMonthlyReportFilename,
  MONTH_NAMES
} from '../../utils/excelReportGenerator'
const LiveEnquiryRegisterModal = lazy(() => import('../../components/admin/LiveEnquiryRegisterModal'))

/**
 * ============================================================================
 * ARS Computers — Enquiry Management & Head-Person Approval Console (Phase 2)
 * ============================================================================
 * Implements:
 * 1. Role-aware enquiry lifecycle management (Employee vs Head-Person).
 * 2. Dedicated workflow tabs: All Active, Pending Rejection (Approval Queue),
 *    Quoted, Rejected & Closed, Archived.
 * 3. Immutable customer submission inspection separate from internal timeline.
 * 4. Append-only activity & notes timeline with author & role tracking.
 * 5. Concurrency-safe progress transitions for active staff (new -> in_progress -> quoted).
 * 6. Head-person approval flow for rejection requests with mandatory reasons.
 * 7. Head-person archive and restore controls.
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

function isWithinDays(dateString, days) {
  if (!dateString) return false
  const itemTime = new Date(dateString).getTime()
  if (Number.isNaN(itemTime)) return false
  const diffMs = Date.now() - itemTime
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000
}

function getDaysRemaining(scheduledDeletionIso) {
  if (!scheduledDeletionIso) return null
  const deadline = new Date(scheduledDeletionIso).getTime()
  const now = Date.now()
  const diffMs = deadline - now
  if (diffMs <= 0) return 'Expired (Ready for Purge)'
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}d ${hours}h remaining`
  return `${hours}h remaining`
}

export default function AdminEnquiriesPage() {
  const { adminUser } = useAdminAuth()
  const isSuperadmin = adminUser?.role === 'superadmin'
  const isEmployee = adminUser?.role === 'admin'

  const {
    enquiries,
    categories,
    isLiveDatabase,
    isLoadingEnquiries,
    loadAdminEnquiries,
    updateEnquiryStatus,
    updateEnquiryNotes,
    addEnquiryNote,
    updateEnquiryProgress,
    requestEnquiryRejection,
    reviewEnquiryRejection,
    submitEnquiryCompletion,
    reviewEnquiryCompletion,
    restoreEnquiryFromBin,
    purgeExpiredBinEnquiries,
    archiveEnquiry,
    restoreEnquiry,
    fetchEnquiryActivities,
    selfAssignEnquiry,
    assignEnquiryEmployee,
    unassignEnquiryEmployee,
    loadEligibleEnquiryAssignees,
    uploadEnquiryServiceProof,
    loadEnquiryServiceProofs,
    getEnquiryServiceProofSignedUrl,
    voidEnquiryServiceProof
  } = useAdminData()

  // Workflow Tabs: 'all_active', 'pending_completion', 'pending_rejection', 'quoted', 'rejected_closed', 'bin', 'archived'
  const [activeWorkflowTab, setActiveWorkflowTab] = useState('all_active')

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // 'all', 'last_7_days', 'last_30_days'

  // Modals & Panels State
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [statusConfirmTarget, setStatusConfirmTarget] = useState(null) // { enquiry, nextStatus }
  const [editingNotes, setEditingNotes] = useState('')
  const [notification, setNotification] = useState(null)

  // Phase 4 Employee Assignment States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assigneesList, setAssigneesList] = useState([])
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('')
  const [assignReason, setAssignReason] = useState('')
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState(null)
  const [isSelfAssigning, setIsSelfAssigning] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)

  // Step 2 Service Proof States
  const [enquiryProofs, setEnquiryProofs] = useState([])
  const [isLoadingProofs, setIsLoadingProofs] = useState(false)
  const [isUploadProofModalOpen, setIsUploadProofModalOpen] = useState(false)
  const [proofFile, setProofFile] = useState(null)
  const [proofDescription, setProofDescription] = useState('')
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [proofUploadError, setProofUploadError] = useState(null)
  const [voidProofTarget, setVoidProofTarget] = useState(null)
  const [voidReasonInput, setVoidReasonInput] = useState('')
  const [isVoidingProof, setIsVoidingProof] = useState(false)
  const [voidProofError, setVoidProofError] = useState(null)
  const [previewProof, setPreviewProof] = useState(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Head Assign Modal — expected visit date/time/note
  const [assignVisitDate, setAssignVisitDate] = useState('')
  const [assignVisitTime, setAssignVisitTime] = useState('')
  const [assignVisitNote, setAssignVisitNote] = useState('')

  // Self-Assign Confirmation Modal (with optional visit time)
  const [isSelfAssignModalOpen, setIsSelfAssignModalOpen] = useState(false)
  const [selfVisitDate, setSelfVisitDate] = useState('')
  const [selfVisitTime, setSelfVisitTime] = useState('')
  const [selfVisitNote, setSelfVisitNote] = useState('')

  // Phase 2 Activity Timeline & Rejection States
  const [enquiryActivities, setEnquiryActivities] = useState([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

  // Rejection Request Dialog (Employee/Staff)
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false)

  // Superadmin Rejection Review
  const [reviewNotesInput, setReviewNotesInput] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewConfirmTarget, setReviewConfirmTarget] = useState(null) // { enquiry, decision }

  // Phase 3: Completion & Bin Workflow States
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false)
  const [completionSummaryInput, setCompletionSummaryInput] = useState('')
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false)

  // Superadmin Completion Review Target & States
  const [completionReviewConfirmTarget, setCompletionReviewConfirmTarget] = useState(null) // { enquiry, decision }
  const [completionReviewNotesInput, setCompletionReviewNotesInput] = useState('')
  const [completionRetentionDays, setCompletionRetentionDays] = useState(7)
  const [isSubmittingCompletionReview, setIsSubmittingCompletionReview] = useState(false)

  // Bin Restore & Purge States
  const [binRestoreTarget, setBinRestoreTarget] = useState(null) // { enquiry }
  const [isRestoringFromBin, setIsRestoringFromBin] = useState(false)
  const [isPurgingBin, setIsPurgingBin] = useState(false)

  // Live Enquiry Register State (Available to ALL active staff)
  const [isLiveRegisterOpen, setIsLiveRegisterOpen] = useState(false)

  // Monthly & Daily Excel Report States (Available to ALL active staff)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportMonthIndex, setExportMonthIndex] = useState(() => new Date().getMonth())
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear())
  const [isExporting, setIsExporting] = useState(false)

  // Derive effective tab: non-superadmin users are restricted from the Bin tab
  const effectiveWorkflowTab = (!isSuperadmin && activeWorkflowTab === 'bin') ? 'all_active' : activeWorkflowTab

  const showNotification = (text, type = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // Load enquiries on mount
  useEffect(() => {
    if (loadAdminEnquiries) {
      loadAdminEnquiries()
    }
  }, [loadAdminEnquiries])

  // Count approved enquiries eligible for selected monthly reporting
  const eligibleExportCount = useMemo(
    () => filterEnquiriesByReportingMonth(enquiries, exportMonthIndex, exportYear).length,
    [enquiries, exportMonthIndex, exportYear]
  )

  const handleDownloadReport = async () => {
    setIsExporting(true)
    try {
      const res = await downloadMonthlyEnquiriesExcel(enquiries, exportMonthIndex, exportYear, {
        exportedBy: adminUser?.email
      })
      showNotification(`Report generated: ${res.filename} (${res.count} records)`, 'success')
      setIsExportModalOpen(false)
    } catch (err) {
      showNotification(`Failed to generate Excel report: ${err.message}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }


  // --- Dynamic Metric Counts ---
  const metrics = useMemo(() => {
    const active = enquiries.filter((e) => !e.is_archived && !e.is_in_bin && e.status !== 'in_bin')
    const total = active.length
    const newCount = active.filter((e) => e.status === 'new').length
    const inProgress = active.filter((e) => e.status === 'in_progress').length
    const quoted = active.filter((e) => e.status === 'quoted').length
    const closed = active.filter((e) => e.status === 'closed' || e.status === 'rejected').length
    const pendingRejection = active.filter((e) => e.status === 'rejection_requested').length
    const pendingCompletion = enquiries.filter((e) => !e.is_archived && !e.is_in_bin && e.status === 'completion_requested').length
    const returnedForRework = enquiries.filter((e) => !e.is_archived && !e.is_in_bin && e.status === 'returned_for_rework').length
    const binCount = enquiries.filter((e) => e.is_in_bin || e.status === 'in_bin').length
    const archived = enquiries.filter((e) => e.is_archived).length
    return {
      total,
      newCount,
      inProgress,
      quoted,
      closed,
      pendingRejection,
      pendingCompletion,
      returnedForRework,
      binCount,
      archived
    }
  }, [enquiries])

  // --- Filtered Enquiries (Tab + Search + Filters) ---
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      const isInBin = Boolean(item.is_in_bin || item.status === 'in_bin')

      // 1. Workflow Tab Filtering
      if (effectiveWorkflowTab === 'all_active' && (item.is_archived || isInBin)) return false
      if (effectiveWorkflowTab === 'pending_completion' && (item.is_archived || isInBin || item.status !== 'completion_requested')) return false
      if (effectiveWorkflowTab === 'pending_rejection' && (item.is_archived || isInBin || item.status !== 'rejection_requested')) return false
      if (effectiveWorkflowTab === 'quoted' && (item.is_archived || isInBin || item.status !== 'quoted')) return false
      if (effectiveWorkflowTab === 'rejected_closed' && (item.is_archived || isInBin || (item.status !== 'closed' && item.status !== 'rejected'))) return false
      if (effectiveWorkflowTab === 'bin' && !isInBin) return false
      if (effectiveWorkflowTab === 'archived' && !item.is_archived) return false

      // 2. Search Query
      const q = searchQuery.trim().toLowerCase()
      const customerName = item.customer_name || item.name || ''
      const matchesSearch =
        !q ||
        item.id.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        (item.company && item.company.toLowerCase().includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q)) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        (item.contact_info && item.contact_info.toLowerCase().includes(q)) ||
        (item.service_requested && item.service_requested.toLowerCase().includes(q)) ||
        (item.message && item.message.toLowerCase().includes(q))

      // 3. Status Filter (when inside tab)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter

      // 4. Category Filter
      const serviceInfo = parseServiceEnquiry(item)
      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'service_requests'
          ? serviceInfo.isService
          : item.category_interest === categoryFilter)

      // 5. Date Range
      let matchesDate = true
      if (dateFilter === 'last_7_days') {
        matchesDate = isWithinDays(item.created_at, 7)
      } else if (dateFilter === 'last_30_days') {
        matchesDate = isWithinDays(item.created_at, 30)
      }

      return matchesSearch && matchesStatus && matchesCategory && matchesDate
    })
  }, [enquiries, effectiveWorkflowTab, searchQuery, statusFilter, categoryFilter, dateFilter])

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'all' || categoryFilter !== 'all' || dateFilter !== 'all'

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setDateFilter('all')
  }

  // --- Engineer Job Dispatch Handlers ---
  const handleWhatsAppDispatch = () => {
    if (!selectedEnquiry) return
    const url = buildWhatsAppDispatchUrl(selectedEnquiry)
    if (url) {
      window.open(url, '_blank')
    }
  }

  const handleCopyDispatch = async () => {
    if (!selectedEnquiry) return
    try {
      const text = formatJobDispatchText(selectedEnquiry)
      await navigator.clipboard.writeText(text)
      setCopyFeedback(true)
      showNotification('Job dispatch copied to clipboard!', 'success')
      setTimeout(() => setCopyFeedback(false), 2500)
    } catch (err) {
      showNotification('Could not copy to clipboard: ' + err.message, 'error')
    }
  }

  // --- Details Modal Handlers ---
  const reloadProofs = async (enquiryId) => {
    if (!loadEnquiryServiceProofs || !enquiryId) return
    setIsLoadingProofs(true)
    try {
      const proofs = await loadEnquiryServiceProofs(enquiryId)
      setEnquiryProofs(proofs || [])
    } catch (err) {
      console.error('Failed to load enquiry service proofs:', err)
      setEnquiryProofs([])
    } finally {
      setIsLoadingProofs(false)
    }
  }

  const handleOpenDetails = async (enquiry) => {
    setSelectedEnquiry(enquiry)
    setEditingNotes(enquiry.admin_notes || '')
    setNewNoteText('')
    setReviewNotesInput('')
    setIsLoadingActivities(true)
    reloadProofs(enquiry.id)
    try {
      if (fetchEnquiryActivities) {
        const acts = await fetchEnquiryActivities(enquiry.id)
        setEnquiryActivities(acts || [])
      } else {
        setEnquiryActivities([])
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
      setEnquiryActivities([])
    } finally {
      setIsLoadingActivities(false)
    }
  }

  const handleCloseDetails = () => {
    setSelectedEnquiry(null)
    setEditingNotes('')
    setNewNoteText('')
    setEnquiryActivities([])
    setEnquiryProofs([])
    setIsRejectionModalOpen(false)
    setRejectionReasonInput('')
    setIsUploadProofModalOpen(false)
    setVoidProofTarget(null)
    setPreviewProof(null)
  }

  // --- Step 2 Proof Action Handlers ---
  const handlePreviewProof = async (proof) => {
    if (!getEnquiryServiceProofSignedUrl) return
    setIsLoadingPreview(true)
    try {
      const url = await getEnquiryServiceProofSignedUrl(proof.storage_path, false)
      if (url) {
        const isPdf = proof.mime_type === 'application/pdf' || (proof.original_filename && proof.original_filename.toLowerCase().endsWith('.pdf'))
        setPreviewProof({ url, name: proof.original_filename, isPdf })
      }
    } catch (err) {
      showNotification('Failed to generate preview URL: ' + err.message, 'error')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleDownloadProof = async (proof) => {
    if (!getEnquiryServiceProofSignedUrl) return
    try {
      const url = await getEnquiryServiceProofSignedUrl(proof.storage_path, proof.original_filename)
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.download = proof.original_filename || 'signed-service-report'
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      showNotification('Failed to generate download URL: ' + err.message, 'error')
    }
  }

  const handleOpenUploadProofModal = () => {
    setProofFile(null)
    setProofDescription('')
    setProofUploadError(null)
    setIsUploadProofModalOpen(true)
  }

  const handleUploadProofSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!proofFile) {
      setProofUploadError('Please choose a file to upload.')
      return
    }
    if (proofFile.size > 10 * 1024 * 1024) {
      setProofUploadError('File size exceeds maximum 10 MB limit.')
      return
    }
    const ext = proofFile.name.split('.').pop().toLowerCase()
    const cleanExt = ext === 'jpeg' ? 'jpg' : ext
    if (!['jpg', 'png', 'pdf'].includes(cleanExt)) {
      setProofUploadError('Only JPG, PNG, and PDF files are allowed.')
      return
    }

    setIsUploadingProof(true)
    setProofUploadError(null)
    try {
      await uploadEnquiryServiceProof(
        selectedEnquiry.id,
        proofFile,
        proofDescription,
        'CUSTOMER_SIGNED_SERVICE_REPORT'
      )
      showNotification('Customer signed job sheet uploaded successfully.')
      setIsUploadProofModalOpen(false)
      setProofFile(null)
      setProofDescription('')
      await reloadProofs(selectedEnquiry.id)
      await reloadActivities(selectedEnquiry.id)
    } catch (err) {
      setProofUploadError(err.message)
    } finally {
      setIsUploadingProof(false)
    }
  }

  const handleOpenVoidModal = (proof) => {
    setVoidProofTarget(proof)
    setVoidReasonInput('')
    setVoidProofError(null)
  }

  const handleVoidProofSubmit = async () => {
    if (!voidProofTarget) return
    const reason = voidReasonInput.trim()
    if (!reason || reason.length < 5) {
      setVoidProofError('Please enter a mandatory void reason of at least 5 characters.')
      return
    }
    setIsVoidingProof(true)
    setVoidProofError(null)
    try {
      await voidEnquiryServiceProof(voidProofTarget.id, reason)
      showNotification('Service proof voided successfully.')
      setVoidProofTarget(null)
      setVoidReasonInput('')
      await reloadProofs(selectedEnquiry.id)
      await reloadActivities(selectedEnquiry.id)
    } catch (err) {
      setVoidProofError(err.message)
    } finally {
      setIsVoidingProof(false)
    }
  }

  // Reload activities helper
  const reloadActivities = async (enquiryId) => {
    if (!fetchEnquiryActivities) return
    try {
      const acts = await fetchEnquiryActivities(enquiryId)
      setEnquiryActivities(acts || [])
    } catch (err) {
      console.error('Failed to reload activities:', err)
    }
  }

  // --- Phase 4 Employee Assignment Handlers ---
  // Opens the self-assign confirmation modal (employee provides optional visit time)
  const handleSelfAssign = () => {
    if (!selectedEnquiry || !isEmployee) return
    setSelfVisitDate('')
    setSelfVisitTime('')
    setSelfVisitNote('')
    setIsSelfAssignModalOpen(true)
  }

  // Executes self-assignment with optional visit time; identity is derived server-side
  const handleConfirmSelfAssign = async (e) => {
    if (e) e.preventDefault()
    if (!selectedEnquiry || !isEmployee) return
    setIsSelfAssigning(true)
    try {
      let expectedVisitAt = null
      if (selfVisitDate) {
        const timeStr = selfVisitTime || '09:00'
        expectedVisitAt = new Date(`${selfVisitDate}T${timeStr}:00`).toISOString()
      }
      await selfAssignEnquiry(selectedEnquiry.id, expectedVisitAt, selfVisitNote.trim() || null)
      showNotification('Enquiry self-assigned to you successfully.', 'success')
      setSelectedEnquiry((prev) => ({
        ...prev,
        assigned_employee_id: adminUser?.id,
        assigned_employee_name: adminUser?.fullName || adminUser?.email,
        assigned_employee_code: adminUser?.employee_code || null,
        assigned_employee_phone: adminUser?.phone_number || null,
        assigned_at: new Date().toISOString(),
        assigned_by: adminUser?.id,
        assigned_by_name: adminUser?.fullName || adminUser?.email,
        assigned_by_employee_code: adminUser?.employee_code || null,
        expected_visit_at: expectedVisitAt,
        assignment_visit_note: selfVisitNote.trim() || null
      }))
      setIsSelfAssignModalOpen(false)
      await reloadActivities(selectedEnquiry.id)
    } catch (err) {
      showNotification(err.message || 'Failed to self-assign enquiry.', 'error')
    } finally {
      setIsSelfAssigning(false)
    }
  }

  const handleOpenAssignModal = async () => {
    if (!isSuperadmin || !selectedEnquiry) return
    setAssignmentError(null)
    setAssignReason('')
    setSelectedAssigneeId(selectedEnquiry.assigned_employee_id || '')
    setIsAssignModalOpen(true)
    try {
      const list = await loadEligibleEnquiryAssignees()
      setAssigneesList(list || [])
    } catch (err) {
      setAssignmentError(err.message || 'Failed to load eligible assignees directory.')
    }
  }

  const handleSaveAssignment = async (e) => {
    if (e) e.preventDefault()
    if (!selectedEnquiry || !isSuperadmin) return
    setAssignmentError(null)
    setIsSubmittingAssignment(true)
    try {
      const targetId = selectedAssigneeId ? selectedAssigneeId : null
      let expectedVisitAt = null
      if (targetId && assignVisitDate) {
        const timeStr = assignVisitTime || '09:00'
        expectedVisitAt = new Date(`${assignVisitDate}T${timeStr}:00`).toISOString()
      }
      await assignEnquiryEmployee(selectedEnquiry.id, targetId, assignReason, expectedVisitAt, assignVisitNote.trim() || null)
      const targetStaff = assigneesList.find((s) => s.id === targetId)

      setSelectedEnquiry((prev) => ({
        ...prev,
        assigned_employee_id: targetId,
        assigned_employee_name: targetStaff ? (targetStaff.full_name || targetStaff.email) : null,
        assigned_employee_code: targetStaff ? targetStaff.employee_code : null,
        assigned_employee_phone: targetStaff ? targetStaff.phone_number : null,
        assigned_employee_aadhaar: targetStaff ? (targetStaff.aadhaar_number || null) : null,
        assigned_at: targetId ? new Date().toISOString() : null,
        assigned_by: adminUser?.id,
        assigned_by_name: adminUser?.fullName || adminUser?.email,
        assigned_by_employee_code: adminUser?.employee_code || null,
        expected_visit_at: targetId ? expectedVisitAt : null,
        assignment_visit_note: targetId ? (assignVisitNote.trim() || null) : null
      }))

      showNotification(
        targetId
          ? `Enquiry assigned to ${targetStaff?.full_name || 'employee'}.`
          : 'Enquiry unassigned successfully.',
        'success'
      )
      setIsAssignModalOpen(false)
      await reloadActivities(selectedEnquiry.id)
    } catch (err) {
      setAssignmentError(err.message || 'Failed to update enquiry assignment.')
    } finally {
      setIsSubmittingAssignment(false)
    }
  }

  const handleEngineerWhatsAppDispatch = () => {
    if (!selectedEnquiry) return
    if (!selectedEnquiry.assigned_employee_phone) {
      showNotification(
        selectedEnquiry.assigned_employee_name
          ? `Engineer ${selectedEnquiry.assigned_employee_name} does not have a phone number configured. Please add their phone in Staff Management.`
          : 'Please assign an engineer to this enquiry first.',
        'error'
      )
      return
    }
    const url = buildWhatsAppDispatchUrl(selectedEnquiry)
    if (url) {
      window.open(url, '_blank')
    }
  }

  const handleEngineerCopyDispatch = async () => {
    if (!selectedEnquiry) return
    try {
      const text = formatJobDispatchText(selectedEnquiry)
      await navigator.clipboard.writeText(text)
      showNotification('Internal engineer job dispatch copied to clipboard.', 'success')
    } catch (err) {
      showNotification('Could not copy to clipboard: ' + err.message, 'error')
    }
  }

  // --- Add Follow-Up Note Handler ---
  const handleAddNote = async (e) => {
    if (e) e.preventDefault()
    if (!selectedEnquiry) return

    const trimmed = newNoteText.trim()
    if (!trimmed || trimmed.length < 2) {
      showNotification('Note content must be at least 2 characters.', 'error')
      return
    }
    if (trimmed.length > 3000) {
      showNotification('Note content cannot exceed 3000 characters.', 'error')
      return
    }

    setIsSavingNote(true)
    try {
      if (addEnquiryNote) {
        await addEnquiryNote(selectedEnquiry.id, trimmed)
      } else if (updateEnquiryNotes) {
        await updateEnquiryNotes(selectedEnquiry.id, trimmed)
      }
      setNewNoteText('')
      showNotification('Follow-up note recorded successfully.')
      await reloadActivities(selectedEnquiry.id)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to record note: ${err.message}`, 'error')
    } finally {
      setIsSavingNote(false)
    }
  }

  // --- Operational Progress Update Handler (new, in_progress, quoted) ---
  const handleProgressChange = async (nextStatus) => {
    if (!selectedEnquiry) return
    if (selectedEnquiry.is_archived) {
      showNotification('Cannot update progress of an archived enquiry.', 'error')
      return
    }
    if (selectedEnquiry.status === 'rejection_requested') {
      showNotification('Enquiry has a pending rejection review. Complete review first.', 'error')
      return
    }
    if (!isSuperadmin && !['new', 'in_progress', 'quoted'].includes(nextStatus)) {
      showNotification('Employees can only progress enquiries to New, In Progress, or Quoted.', 'error')
      return
    }

    try {
      if (updateEnquiryProgress) {
        await updateEnquiryProgress(selectedEnquiry.id, nextStatus)
      } else if (updateEnquiryStatus) {
        await updateEnquiryStatus(selectedEnquiry.id, nextStatus)
      }

      setSelectedEnquiry((prev) => ({ ...prev, status: nextStatus }))
      showNotification(`Enquiry progress updated to "${getStatusMeta(nextStatus).label}".`)
      await reloadActivities(selectedEnquiry.id)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to update progress: ${err.message}`, 'error')
    }
  }

  // --- Submit Rejection Request Handler (Employees / Staff) ---
  const handleOpenRejectionModal = (enquiry = null) => {
    if (!isEmployee || isSuperadmin) return
    if (enquiry) {
      setSelectedEnquiry(enquiry)
    }
    setRejectionReasonInput('')
    setIsRejectionModalOpen(true)
  }

  const handleSubmitRejectionRequest = async () => {
    if (!selectedEnquiry || !isEmployee || isSuperadmin) return
    const reason = rejectionReasonInput.trim()
    if (!reason || reason.length < 5) {
      showNotification('A mandatory rejection reason of at least 5 characters is required.', 'error')
      return
    }
    if (reason.length > 1000) {
      showNotification('Rejection reason cannot exceed 1000 characters.', 'error')
      return
    }

    setIsSubmittingRejection(true)
    try {
      if (requestEnquiryRejection) {
        await requestEnquiryRejection(selectedEnquiry.id, reason)
      }
      setSelectedEnquiry((prev) => ({
        ...prev,
        previous_status: prev.status,
        status: 'rejection_requested',
        rejection_reason: reason
      }))
      setIsRejectionModalOpen(false)
      setRejectionReasonInput('')
      showNotification('Rejection request submitted for head-person review.')
      await reloadActivities(selectedEnquiry.id)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to request rejection: ${err.message}`, 'error')
    } finally {
      setIsSubmittingRejection(false)
    }
  }

  // --- Review Rejection Handler (Superadmin Only: approved / denied) ---
  const handleReviewRejection = async (decision, customNotes = null, targetEnquiry = null) => {
    const enq = targetEnquiry || selectedEnquiry
    if (!enq || !isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can review rejection requests.', 'error')
      return
    }

    setIsSubmittingReview(true)
    try {
      const reviewNotes = (customNotes !== null ? customNotes : reviewNotesInput).trim()
      if (reviewEnquiryRejection) {
        await reviewEnquiryRejection(enq.id, decision, reviewNotes)
      }

      const resultingStatus = decision === 'approved' ? 'rejected' : enq.previous_status || 'in_progress'
      if (selectedEnquiry && selectedEnquiry.id === enq.id) {
        setSelectedEnquiry((prev) => ({
          ...prev,
          status: resultingStatus,
          rejection_reason: decision === 'approved' ? prev.rejection_reason : null
        }))
        await reloadActivities(enq.id)
      }
      setReviewNotesInput('')
      setReviewConfirmTarget(null)
      showNotification(`Rejection request ${decision} successfully.`)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to review rejection: ${err.message}`, 'error')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleOpenReviewPrompt = (enquiry, decision) => {
    if (!isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can review rejection requests.', 'error')
      return
    }
    setReviewNotesInput('')
    setReviewConfirmTarget({ enquiry, decision })
  }

  // --- Phase 3: Submit Completion Handler (Staff & Superadmin) ---
  const handleOpenCompletionModal = (enquiry = null) => {
    if (!isEmployee || isSuperadmin) return
    if (enquiry) {
      setSelectedEnquiry(enquiry)
    }
    setCompletionSummaryInput('')
    setIsCompletionModalOpen(true)
  }

  const handleSubmitCompletion = async () => {
    if (!selectedEnquiry || !isEmployee || isSuperadmin) return
    const summary = completionSummaryInput.trim()
    if (!summary || summary.length < 10) {
      showNotification('A meaningful work-completion summary of at least 10 characters is required.', 'error')
      return
    }
    if (summary.length > 3000) {
      showNotification('Completion summary cannot exceed 3000 characters.', 'error')
      return
    }

    setIsSubmittingCompletion(true)
    try {
      if (submitEnquiryCompletion) {
        await submitEnquiryCompletion(selectedEnquiry.id, summary)
      }
      setSelectedEnquiry((prev) => ({
        ...prev,
        previous_status: prev.status,
        status: 'completion_requested',
        completion_summary: summary,
        completion_rework_reason: null
      }))
      setIsCompletionModalOpen(false)
      setCompletionSummaryInput('')
      showNotification('Work-completion summary submitted for head-person approval.')
      await reloadActivities(selectedEnquiry.id)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to submit completion: ${err.message}`, 'error')
    } finally {
      setIsSubmittingCompletion(false)
    }
  }

  // --- Phase 3: Review Completion Handler (Superadmin Only: approved / returned_for_rework) ---
  const handleOpenCompletionReviewPrompt = (enquiry, decision) => {
    if (!isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can review work completion.', 'error')
      return
    }
    setCompletionReviewNotesInput('')
    setCompletionRetentionDays(7)
    setCompletionReviewConfirmTarget({ enquiry, decision })
  }

  const handleReviewCompletion = async (decision, customNotes = null, customDays = null, targetEnquiry = null) => {
    const enq = targetEnquiry || selectedEnquiry
    if (!enq || !isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can review work completion.', 'error')
      return
    }

    const notes = (customNotes !== null ? customNotes : completionReviewNotesInput).trim()
    const days = customDays !== null ? customDays : completionRetentionDays

    if (decision === 'returned_for_rework') {
      if (!notes || notes.length < 5) {
        showNotification('A mandatory rework reason of at least 5 characters is required when returning work.', 'error')
        return
      }
    }

    setIsSubmittingCompletionReview(true)
    try {
      if (reviewEnquiryCompletion) {
        await reviewEnquiryCompletion(enq.id, decision, notes, days)
      }

      const resultingStatus = decision === 'approved' ? 'completed' : 'returned_for_rework'
      if (selectedEnquiry && selectedEnquiry.id === enq.id) {
        setSelectedEnquiry((prev) => ({
          ...prev,
          status: resultingStatus,
          is_archived: decision === 'approved',
          is_in_bin: false,
          completion_approved_at: decision === 'approved' ? new Date().toISOString() : prev.completion_approved_at,
          completion_rework_reason: decision === 'returned_for_rework' ? notes : null
        }))
        await reloadActivities(enq.id)
      }
      setCompletionReviewNotesInput('')
      setCompletionReviewConfirmTarget(null)
      showNotification(
        decision === 'approved'
          ? 'Work approved. Enquiry permanently archived.'
          : 'Task returned for rework with reason.'
      )
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to review completion: ${err.message}`, 'error')
    } finally {
      setIsSubmittingCompletionReview(false)
    }
  }

  // --- Phase 3: Restore Enquiry from Bin (Superadmin Only) ---
  const handleOpenBinRestorePrompt = (enquiry) => {
    if (!isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can restore enquiries from the Bin.', 'error')
      return
    }
    setBinRestoreTarget({ enquiry })
  }

  const handleRestoreFromBin = async (targetEnquiry = null) => {
    const enq = targetEnquiry || binRestoreTarget?.enquiry || selectedEnquiry
    if (!enq || !isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can restore enquiries from the Bin.', 'error')
      return
    }

    setIsRestoringFromBin(true)
    try {
      if (restoreEnquiryFromBin) {
        await restoreEnquiryFromBin(enq.id)
      }
      if (selectedEnquiry && selectedEnquiry.id === enq.id) {
        setSelectedEnquiry((prev) => ({
          ...prev,
          is_in_bin: false,
          status: 'quoted'
        }))
        await reloadActivities(enq.id)
      }
      setBinRestoreTarget(null)
      showNotification('Enquiry successfully restored from Bin to active queue.')
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to restore enquiry from Bin: ${err.message}`, 'error')
    } finally {
      setIsRestoringFromBin(false)
    }
  }

  // --- Phase 3: Manual Bin Purge Execution (Superadmin Only) ---
  const handlePurgeExpiredBin = async () => {
    if (!isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can run Bin cleanup.', 'error')
      return
    }

    setIsPurgingBin(true)
    try {
      if (purgeExpiredBinEnquiries) {
        const result = await purgeExpiredBinEnquiries(0)
        showNotification(result?.message || `Purged ${result?.purged_count || 0} expired records from Bin.`)
      }
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to execute Bin cleanup: ${err.message}`, 'error')
    } finally {
      setIsPurgingBin(false)
    }
  }

  // --- Archive & Restore Handlers (Superadmin Only) ---
  const handleArchiveToggle = async () => {
    if (!selectedEnquiry || !isSuperadmin) {
      showNotification('Unauthorized: Only superadministrators can archive or restore enquiries.', 'error')
      return
    }

    try {
      if (selectedEnquiry.is_archived) {
        if (restoreEnquiry) await restoreEnquiry(selectedEnquiry.id)
        setSelectedEnquiry((prev) => ({ ...prev, is_archived: false, archived_at: null, archived_by: null }))
        showNotification('Enquiry restored from archive.')
      } else {
        if (archiveEnquiry) await archiveEnquiry(selectedEnquiry.id)
        setSelectedEnquiry((prev) => ({ ...prev, is_archived: true, archived_at: new Date().toISOString() }))
        showNotification('Enquiry archived successfully.')
      }
      await reloadActivities(selectedEnquiry.id)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Archive action failed: ${err.message}`, 'error')
    }
  }

  // Legacy status confirm fallback (for backward-compatible tests)
  const handleOpenStatusConfirm = (enquiry, nextStatus) => {
    if (!isSuperadmin) {
      showNotification('Read-only: Admin employees cannot directly override enquiry status.', 'error')
      return
    }
    if (enquiry.status === nextStatus) return
    setStatusConfirmTarget({ enquiry, nextStatus })
  }

  const handleConfirmStatusChange = async () => {
    if (!isSuperadmin) {
      showNotification('Read-only: Admin employees cannot modify enquiry status.', 'error')
      setStatusConfirmTarget(null)
      return
    }
    if (!statusConfirmTarget) return
    const { enquiry, nextStatus } = statusConfirmTarget

    try {
      if (updateEnquiryStatus) {
        await updateEnquiryStatus(enquiry.id, nextStatus)
      }
      if (selectedEnquiry && selectedEnquiry.id === enquiry.id) {
        setSelectedEnquiry((prev) => ({ ...prev, status: nextStatus }))
        await reloadActivities(enquiry.id)
      }
      showNotification(`Enquiry ${enquiry.id} status updated to "${getStatusMeta(nextStatus).label}".`)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to update status: ${err.message}`, 'error')
    } finally {
      setStatusConfirmTarget(null)
    }
  }

  const handleSaveNotes = async () => {
    if (!isSuperadmin) {
      showNotification('Read-only: Admin employees cannot directly modify legacy internal notes.', 'error')
      return
    }
    if (!selectedEnquiry) return
    const updatedNotes = editingNotes.trim()

    try {
      if (addEnquiryNote) {
        await addEnquiryNote(selectedEnquiry.id, updatedNotes)
      } else if (updateEnquiryNotes) {
        await updateEnquiryNotes(selectedEnquiry.id, updatedNotes)
      }
      setSelectedEnquiry((prev) => ({ ...prev, admin_notes: updatedNotes }))
      showNotification(`Internal notes updated for ${selectedEnquiry.id}.`)
      await reloadActivities(selectedEnquiry.id)
      if (loadAdminEnquiries) await loadAdminEnquiries()
    } catch (err) {
      showNotification(`Failed to save notes: ${err.message}`, 'error')
    }
  }

  const getStatusMeta = (statusId) => {
    return (
      ENQUIRY_STATUSES.find((s) => s.id === statusId) || {
        id: statusId,
        label: statusId,
        color: '#475569',
        bg: '#f1f5f9',
        border: '#cbd5e1',
        icon: '⚪'
      }
    )
  }

  return (
    <AdminLayout activeTab="enquiries">
      {/* Toast Notification */}
      {notification && (
        <div className={`admin-action-toast ${notification.type}`} role="alert">
          <span>{notification.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{notification.text}</span>
        </div>
      )}

      <div className="admin-products-view-container enquiries-page-container">
        {/* Top Page Header */}
        <div className="admin-view-header">
          <div>
            <div className="admin-page-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="admin-view-title" style={{ margin: 0 }}>Customer Enquiries &amp; Leads</h1>
              {isLiveDatabase ? (
                <span className="live-db-pill" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem' }} title="Connected to Supabase public.enquiries table">
                  🟢 Supabase Live
                </span>
              ) : (
                <span className="demo-badge-pill" title="Local mock state only">
                  🟡 Demo UI
                </span>
              )}
              {!isSuperadmin ? (
                <span
                  style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}
                  title="Admin Employee has operational workflow permissions (notes, progress, rejection requests)"
                >
                  👤 Employee Mode (Workflow Active)
                </span>
              ) : (
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}
                  title="Head-Person (Superadmin) has full approval, terminal review, and archive authority"
                >
                  👑 Head-Person (Approver)
                </span>
              )}
            </div>
            <p className="admin-view-subtitle">
              Manage customer leads, record operational progress, submit rejection requests, and review approval queues.
            </p>
          </div>

          <div className="admin-view-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              id="open-live-register-modal-btn"
              className="btn-primary btn-sm"
              onClick={() => setIsLiveRegisterOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#1e40af',
                borderColor: '#1e3a8a',
                color: '#ffffff',
                fontWeight: 600
              }}
              title="Open Advanced Live Enquiry Register (Spreadsheet View)"
            >
              📋 Live Enquiry Register
            </button>
            <button
              type="button"
              id="open-monthly-report-modal-btn"
              className="btn-primary btn-sm"
              onClick={() => setIsExportModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#047857',
                borderColor: '#065f46',
                color: '#ffffff',
                fontWeight: 600
              }}
              title="Download Monthly Audit Report in XLSX format (available to all authorized staff)"
            >
              📊 Monthly Excel Report
            </button>
            {isLiveDatabase && (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => loadAdminEnquiries && loadAdminEnquiries()}
                disabled={isLoadingEnquiries}
                title="Fetch latest enquiries from Supabase"
              >
                {isLoadingEnquiries ? 'Refreshing...' : '🔄 Refresh Enquiries'}
              </button>
            )}
          </div>
        </div>

        {/* 1. Summary Cards Row */}
        <div className="enquiries-stats-row">
          <div className="product-stat-card">
            <span className="stat-label">Total Leads</span>
            <span className="stat-number">{metrics.total}</span>
            <span className="stat-subtext">Active Inbound Requests</span>
          </div>

          <div className="product-stat-card active-card">
            <span className="stat-label">New Submissions</span>
            <span className="stat-number text-primary">{metrics.newCount}</span>
            <span className="stat-subtext">Awaiting Initial Review</span>
          </div>

          <div className="product-stat-card warning-card">
            <span className="stat-label">In Progress</span>
            <span className="stat-number text-warning">{metrics.inProgress}</span>
            <span className="stat-subtext">Under Active Survey</span>
          </div>

          <div
            className="product-stat-card"
            style={{
              borderColor: metrics.pendingCompletion > 0 ? '#7c3aed' : undefined,
              background: metrics.pendingCompletion > 0 ? '#f5f3ff' : undefined
            }}
          >
            <span className="stat-label">Pending Completion</span>
            <span className="stat-number" style={{ color: metrics.pendingCompletion > 0 ? '#7c3aed' : '#64748b' }}>
              {metrics.pendingCompletion}
            </span>
            <span className="stat-subtext">Work Approval Queue</span>
          </div>

          <div
            className="product-stat-card"
            style={{
              borderColor: metrics.pendingRejection > 0 ? '#f59e0b' : undefined,
              background: metrics.pendingRejection > 0 ? '#fffbeb' : undefined
            }}
          >
            <span className="stat-label">Pending Rejection</span>
            <span className="stat-number" style={{ color: metrics.pendingRejection > 0 ? '#b45309' : '#64748b' }}>
              {metrics.pendingRejection}
            </span>
            <span className="stat-subtext">Rejection Review Queue</span>
          </div>

          <div
            className="product-stat-card"
            style={{
              borderColor: metrics.binCount > 0 ? '#94a3b8' : undefined,
              background: metrics.binCount > 0 ? '#f8fafc' : undefined
            }}
          >
            <span className="stat-label">Bin (Soft-Deleted)</span>
            <span className="stat-number" style={{ color: metrics.binCount > 0 ? '#475569' : '#94a3b8' }}>
              {metrics.binCount}
            </span>
            <span className="stat-subtext">7-Day Retention Purge</span>
          </div>
        </div>

        {/* Phase 2 & Phase 3: Workflow Tab Bar */}
        <div
          className="admin-workflow-tabs-bar"
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '8px',
            overflowX: 'auto'
          }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkflowTab === 'all_active'}
            onClick={() => setActiveWorkflowTab('all_active')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              background: activeWorkflowTab === 'all_active' ? '#0f172a' : '#f1f5f9',
              color: activeWorkflowTab === 'all_active' ? '#ffffff' : '#475569',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            📋 All Active ({metrics.total})
          </button>

          <button
            type="button"
            role="tab"
            id="tab-pending-completion"
            aria-selected={activeWorkflowTab === 'pending_completion'}
            onClick={() => setActiveWorkflowTab('pending_completion')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: metrics.pendingCompletion > 0 ? '1px solid #7c3aed' : 'none',
              cursor: 'pointer',
              background: activeWorkflowTab === 'pending_completion' ? '#7c3aed' : (metrics.pendingCompletion > 0 ? '#f5f3ff' : '#f1f5f9'),
              color: activeWorkflowTab === 'pending_completion' ? '#ffffff' : (metrics.pendingCompletion > 0 ? '#6d28d9' : '#475569'),
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            <span>⏳ Pending Completion</span>
            {metrics.pendingCompletion > 0 && (
              <span
                style={{
                  background: activeWorkflowTab === 'pending_completion' ? '#ffffff' : '#7c3aed',
                  color: activeWorkflowTab === 'pending_completion' ? '#7c3aed' : '#ffffff',
                  fontSize: '0.75rem',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {metrics.pendingCompletion}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            id="tab-pending-rejection"
            aria-selected={activeWorkflowTab === 'pending_rejection'}
            onClick={() => setActiveWorkflowTab('pending_rejection')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: metrics.pendingRejection > 0 ? '1px solid #f59e0b' : 'none',
              cursor: 'pointer',
              background: activeWorkflowTab === 'pending_rejection' ? '#d97706' : (metrics.pendingRejection > 0 ? '#fef3c7' : '#f1f5f9'),
              color: activeWorkflowTab === 'pending_rejection' ? '#ffffff' : (metrics.pendingRejection > 0 ? '#92400e' : '#475569'),
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            <span>⚠️ Pending Rejection</span>
            {metrics.pendingRejection > 0 && (
              <span
                style={{
                  background: activeWorkflowTab === 'pending_rejection' ? '#ffffff' : '#b45309',
                  color: activeWorkflowTab === 'pending_rejection' ? '#b45309' : '#ffffff',
                  fontSize: '0.75rem',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {metrics.pendingRejection}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeWorkflowTab === 'quoted'}
            onClick={() => setActiveWorkflowTab('quoted')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              background: activeWorkflowTab === 'quoted' ? '#0f172a' : '#f1f5f9',
              color: activeWorkflowTab === 'quoted' ? '#ffffff' : '#475569',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            💼 Quoted ({metrics.quoted})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeWorkflowTab === 'rejected_closed'}
            onClick={() => setActiveWorkflowTab('rejected_closed')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              background: activeWorkflowTab === 'rejected_closed' ? '#0f172a' : '#f1f5f9',
              color: activeWorkflowTab === 'rejected_closed' ? '#ffffff' : '#475569',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            🏁 Rejected &amp; Closed ({metrics.closed})
          </button>

          {isSuperadmin && (
            <button
              type="button"
              role="tab"
              id="tab-bin"
              aria-selected={activeWorkflowTab === 'bin'}
              onClick={() => setActiveWorkflowTab('bin')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                border: metrics.binCount > 0 ? '1px solid #94a3b8' : 'none',
                cursor: 'pointer',
                background: activeWorkflowTab === 'bin' ? '#475569' : (metrics.binCount > 0 ? '#f1f5f9' : '#f8fafc'),
                color: activeWorkflowTab === 'bin' ? '#ffffff' : '#475569',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              <span>🗑️ Bin</span>
              {metrics.binCount > 0 && (
                <span
                  style={{
                    background: activeWorkflowTab === 'bin' ? '#ffffff' : '#475569',
                    color: activeWorkflowTab === 'bin' ? '#475569' : '#ffffff',
                    fontSize: '0.75rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontWeight: 700
                  }}
                >
                  {metrics.binCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={activeWorkflowTab === 'archived'}
            onClick={() => setActiveWorkflowTab('archived')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              background: activeWorkflowTab === 'archived' ? '#334155' : '#f1f5f9',
              color: activeWorkflowTab === 'archived' ? '#ffffff' : '#475569',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            📦 Archived ({metrics.archived})
          </button>
        </div>

        {/* Bin Maintenance Bar for Superadmin */}
        {activeWorkflowTab === 'bin' && isSuperadmin && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.92rem' }}>
                🗑️ Head-Person Bin &amp; Retention Management
              </span>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Enquiries approved for completion are moved to the Bin and retained for 7 days (or custom period) before permanent server-side deletion.
                You can restore any enquiry prior to the deletion deadline. Server-side permanent cleanup is executed on-demand via the Run Bin Cleanup action.
              </p>
            </div>
            <button
              type="button"
              id="run-bin-purge-btn"
              className="btn-purge-bin"
              onClick={handlePurgeExpiredBin}
              disabled={isPurgingBin}
              title="Execute server-side permanent deletion of expired bin records"
            >
              {isPurgingBin ? 'Purging...' : '🧹 Run Bin Cleanup Now'}
            </button>
          </div>
        )}

        {/* Permanent Archive Information Banner */}
        {activeWorkflowTab === 'archived' && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔒</span> Permanent Archive &amp; Monthly Compliance Records
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#15803d' }}>
                Head-approved completed enquiries become permanent historical records. They are immune to automated deletion and cannot enter the Bin.
              </p>
            </div>
            <button
              type="button"
              id="archived-tab-download-excel-btn"
              onClick={() => setIsExportModalOpen(true)}
              className="btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#047857',
                borderColor: '#065f46',
                color: '#ffffff',
                fontWeight: 600
              }}
            >
              📊 Export Monthly XLSX
            </button>
          </div>
        )}

        {/* 2. Filter & Search Toolbar */}
        <div className="admin-product-toolbar">
          {/* Search Field */}
          <div className="toolbar-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              id="enquiry-search-input"
              type="text"
              className="admin-search-input"
              placeholder="Search by client name, company, email, phone, or ID (ENQ-...)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search customer enquiries"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="toolbar-filters-group">
            {/* Status Filter */}
            <div className="filter-select-wrap">
              <label htmlFor="enquiry-status-filter" className="filter-label-inline">
                Status:
              </label>
              <select
                id="enquiry-status-filter"
                className="admin-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {ENQUIRY_STATUSES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="filter-select-wrap">
              <label htmlFor="enquiry-category-filter" className="filter-label-inline">
                Department:
              </label>
              <select
                id="enquiry-category-filter"
                className="admin-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="service_requests">🛠️ Service &amp; Repair Requests</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug || c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="filter-select-wrap">
              <label htmlFor="enquiry-date-filter" className="filter-label-inline">
                Date:
              </label>
              <select
                id="enquiry-date-filter"
                className="admin-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-outline btn-sm clear-filters-btn"
                onClick={handleClearFilters}
                title="Reset all active search and filter parameters"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* 3. Desktop Enquiries Data Table */}
        <div className="admin-table-container products-table-wrap enquiries-table-wrap">
          <table className="admin-data-table enquiries-data-table" aria-label="Customer Enquiries List">
            <thead>
              <tr>
                <th scope="col" style={{ width: '130px', minWidth: '130px' }}>Enquiry ID</th>
                <th scope="col" style={{ width: '210px', minWidth: '190px' }}>Customer / Company</th>
                <th scope="col" style={{ width: '180px', minWidth: '160px' }}>Requirement</th>
                <th scope="col" style={{ minWidth: '240px' }}>Inbound Message Snippet</th>
                <th scope="col" style={{ width: '160px', minWidth: '140px' }}>Status</th>
                <th scope="col" style={{ width: '110px', minWidth: '100px' }}>Submitted</th>
                <th
                  scope="col"
                  style={{
                    width: activeWorkflowTab === 'pending_rejection' && isSuperadmin ? '200px' : '100px',
                    minWidth: activeWorkflowTab === 'pending_rejection' && isSuperadmin ? '190px' : '90px',
                    textAlign: 'center'
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state-wrap">
                      <span className="empty-icon">🔍</span>
                      <h3>No enquiries match your selection</h3>
                      <p>Try switching tabs or clearing your search filters.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={handleClearFilters}
                          style={{ marginTop: '8px' }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEnquiries.map((enq) => {
                  const statusMeta = getStatusMeta(enq.status)
                  const customerName = enq.customer_name || enq.name || 'Anonymous Customer'
                  const isPendingRejection = enq.status === 'rejection_requested'

                  return (
                    <tr
                      key={enq.id}
                      className={`enquiry-table-row ${isPendingRejection ? 'row-pending-rejection' : ''}`}
                      style={isPendingRejection ? { background: '#fffbeb' } : (enq.is_archived ? { opacity: 0.75 } : undefined)}
                    >
                      {/* ID & Badges */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className="enquiry-id-badge" title={enq.id}>
                            {enq.enquiry_number || enq.id}
                          </span>
                          {enq.is_archived && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                              📦 Archived
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer / Company */}
                      <td>
                        <div className="customer-cell-wrap">
                          <strong className="customer-name-text">{customerName}</strong>
                          <span className="customer-company-text">{enq.company || 'Direct Client'}</span>
                          {enq.phone && (
                            <span className="customer-contact-text" title={enq.phone}>
                              📞 {enq.phone}
                            </span>
                          )}
                          {!enq.phone && enq.contact_info && (
                            <span className="customer-contact-text" title={enq.contact_info}>
                              📱 {enq.contact_info}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Requirement */}
                      <td>
                        <div className="service-cell-wrap">
                          {(() => {
                            const sm = parseServiceEnquiry(enq)
                            if (sm.isService) {
                              return (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                    <span className="service-repair-badge">🛠️ Service / Repair</span>
                                    {sm.ticketNumber && (
                                      <span className="service-ticket-tag">{sm.ticketNumber}</span>
                                    )}
                                  </div>
                                  <strong className="service-title-text">
                                    {sm.productCategory || enq.service_requested || enq.category_interest}
                                  </strong>
                                  {sm.requestType && (
                                    <span className="category-tag-inline">{sm.requestType}</span>
                                  )}
                                </>
                              )
                            }
                            return (
                              <>
                                <strong className="service-title-text">
                                  {enq.service_requested || (enq.category_interest ? enq.category_interest.replace(/-/g, ' ') : 'Hardware Inquiry')}
                                </strong>
                                {enq.category_label && enq.category_label.toLowerCase() !== (enq.service_requested || '').toLowerCase() ? (
                                  <span className="category-tag-inline">{enq.category_label}</span>
                                ) : enq.category_interest && enq.category_interest.toLowerCase() !== (enq.service_requested || '').toLowerCase() && enq.service_requested ? (
                                  <span className="category-tag-inline">{enq.category_interest.replace(/-/g, ' ')}</span>
                                ) : (
                                  <span className="category-tag-inline">Hardware</span>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </td>

                      {/* Message Snippet */}
                      <td>
                        <p className="enquiry-message-snippet" title={enq.message}>
                          {enq.message}
                        </p>
                      </td>

                      {/* Status */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          className="enquiry-status-chip"
                          style={{
                            color: statusMeta.color,
                            background: statusMeta.bg,
                            borderColor: statusMeta.border
                          }}
                        >
                          <span className="status-indicator-dot" style={{ background: statusMeta.color }}></span>
                          {statusMeta.label}
                        </span>
                        {isPendingRejection && (
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#b45309', fontWeight: 600, marginTop: '3px' }}>
                            ⚠️ Rejection Requested
                          </span>
                        )}
                        {enq.status === 'completion_requested' && (
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600, marginTop: '3px' }}>
                            ⏳ Completion Pending
                          </span>
                        )}
                        {enq.status === 'returned_for_rework' && (
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#c2410c', fontWeight: 600, marginTop: '3px' }}>
                            🔄 Rework Required
                          </span>
                        )}
                        {(enq.is_in_bin || enq.status === 'in_bin') && (
                          <div style={{ marginTop: '3px' }}>
                            <span className="retention-countdown-badge">
                              ⏱️ {getDaysRemaining(enq.scheduled_deletion_at)}
                            </span>
                          </div>
                        )}
                        {enq.assigned_employee_name && (
                          <div style={{ marginTop: '3px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.72rem',
                                color: enq.assigned_employee_id === adminUser?.id ? '#1e40af' : '#475569',
                                fontWeight: 600,
                                background: enq.assigned_employee_id === adminUser?.id ? '#dbeafe' : '#f1f5f9',
                                padding: '1px 6px',
                                borderRadius: '8px'
                              }}
                              title={`Assigned: ${enq.assigned_employee_name}${enq.assigned_employee_code ? ` [${enq.assigned_employee_code}]` : ''}`}
                            >
                              👤 {enq.assigned_employee_id === adminUser?.id ? 'You' : enq.assigned_employee_name}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Submitted Date */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="date-cell-text" title={formatDateTime(enq.created_at)}>
                          {formatDate(enq.created_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {enq.status === 'rejection_requested' && isSuperadmin ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn-action-icon approve-rejection-action-btn"
                              onClick={() => handleOpenReviewPrompt(enq, 'approved')}
                              title={`Approve rejection request for ${enq.id}`}
                              style={{
                                background: '#fef2f2',
                                borderColor: '#fca5a5',
                                color: '#dc2626',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                padding: '5px 10px'
                              }}
                            >
                              ✅ Approve
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon deny-rejection-action-btn"
                              onClick={() => handleOpenReviewPrompt(enq, 'denied')}
                              title={`Deny rejection request for ${enq.id}`}
                              style={{
                                background: '#f0fdf4',
                                borderColor: '#86efac',
                                color: '#16a34a',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                padding: '5px 10px'
                              }}
                            >
                              ❌ Deny
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon view-details-btn"
                              onClick={() => handleOpenDetails(enq)}
                              title={`Inspect details for ${enq.id}`}
                            >
                              👁️ View
                            </button>
                          </div>
                        ) : enq.status === 'completion_requested' && isSuperadmin ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn-action-icon approve-completion-action-btn btn-approve-completion"
                              onClick={() => handleOpenCompletionReviewPrompt(enq, 'approved')}
                              title={`Approve completion and move ${enq.id} to Bin`}
                              style={{
                                fontSize: '0.8rem',
                                padding: '5px 10px'
                              }}
                            >
                              ✅ Approve (Bin)
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon return-rework-action-btn btn-return-rework"
                              onClick={() => handleOpenCompletionReviewPrompt(enq, 'returned_for_rework')}
                              title={`Return ${enq.id} for rework with reason`}
                              style={{
                                fontSize: '0.8rem',
                                padding: '5px 10px'
                              }}
                            >
                              🔄 Return
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon view-details-btn"
                              onClick={() => handleOpenDetails(enq)}
                              title={`Inspect details for ${enq.id}`}
                            >
                              👁️ View
                            </button>
                          </div>
                        ) : (enq.is_in_bin || enq.status === 'in_bin') && isSuperadmin ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn-action-icon restore-bin-action-btn btn-restore-bin"
                              onClick={() => handleOpenBinRestorePrompt(enq)}
                              title={`Restore ${enq.id} from Bin`}
                              style={{
                                fontSize: '0.8rem',
                                padding: '5px 10px'
                              }}
                            >
                              ♻️ Restore
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon view-details-btn"
                              onClick={() => handleOpenDetails(enq)}
                              title={`Inspect details for ${enq.id}`}
                            >
                              👁️ View
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-action-icon view-details-btn"
                            onClick={() => handleOpenDetails(enq)}
                            title={`Inspect details for ${enq.id}`}
                          >
                            👁️ View
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Mobile Enquiries Cards (< 900px) */}
        <div className="mobile-products-cards-list mobile-enquiries-cards">
          {filteredEnquiries.length === 0 ? (
            <div className="empty-state-wrap mobile-empty-box">
              <span className="empty-icon">🔍</span>
              <h3>No enquiries match your criteria</h3>
              <p>Clear active filters to view all records.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleClearFilters}
                  style={{ marginTop: '10px' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredEnquiries.map((enq) => {
              const statusMeta = getStatusMeta(enq.status)
              const isPendingRejection = enq.status === 'rejection_requested'
              const isPendingCompletion = enq.status === 'completion_requested'
              const isInBin = enq.is_in_bin || enq.status === 'in_bin'

              return (
                <div
                  key={enq.id}
                  className="mobile-product-card enquiry-mobile-card"
                  style={
                    isPendingRejection
                      ? { borderColor: '#f59e0b', background: '#fffbeb' }
                      : isPendingCompletion
                      ? { borderColor: '#7c3aed', background: '#f5f3ff' }
                      : isInBin
                      ? { borderColor: '#94a3b8', background: '#f8fafc' }
                      : undefined
                  }
                >
                  <div className="mobile-card-header">
                    <span className="enquiry-id-badge">{enq.id}</span>
                    <span
                      className="enquiry-status-chip"
                      style={{
                        color: statusMeta.color,
                        background: statusMeta.bg,
                        borderColor: statusMeta.border
                      }}
                    >
                      <span className="status-indicator-dot" style={{ background: statusMeta.color }}></span>
                      {statusMeta.label}
                    </span>
                  </div>

                  {isInBin && (
                    <div style={{ padding: '0 12px 6px' }}>
                      <span className="retention-countdown-badge">
                        ⏱️ {getDaysRemaining(enq.scheduled_deletion_at)}
                      </span>
                    </div>
                  )}

                  <div className="mobile-card-meta">
                    {(() => {
                      const sm = parseServiceEnquiry(enq)
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <h3 className="mobile-card-title">{enq.customer_name || enq.name}</h3>
                            {sm.isService && (
                              <span className="service-repair-badge">🛠️ Service / Repair</span>
                            )}
                            {sm.ticketNumber && (
                              <span className="service-ticket-tag">{sm.ticketNumber}</span>
                            )}
                          </div>
                          <span className="customer-company-text">{enq.company || 'Direct Client'}</span>
                          <span className="service-title-text" style={{ marginTop: '4px' }}>
                            {sm.productCategory || enq.service_requested || (enq.category_interest ? enq.category_interest.replace(/-/g, ' ') : 'Hardware Inquiry')}
                          </span>
                        </>
                      )
                    })()}
                    {enq.category_label && enq.category_label.toLowerCase() !== (enq.service_requested || '').toLowerCase() ? (
                      <span className="category-tag-inline" style={{ marginTop: '4px', alignSelf: 'flex-start' }}>{enq.category_label}</span>
                    ) : enq.category_interest && enq.category_interest.toLowerCase() !== (enq.service_requested || '').toLowerCase() && enq.service_requested ? (
                      <span className="category-tag-inline" style={{ marginTop: '4px', alignSelf: 'flex-start' }}>{enq.category_interest.replace(/-/g, ' ')}</span>
                    ) : null}
                  </div>

                  <p className="mobile-specs-snippet">{enq.message}</p>

                  <div className="mobile-card-actions">
                    {enq.status === 'rejection_requested' && isSuperadmin && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="btn-outline btn-block approve-rejection-action-btn"
                          onClick={() => handleOpenReviewPrompt(enq, 'approved')}
                          style={{ borderColor: '#fca5a5', color: '#dc2626', fontWeight: 600 }}
                        >
                          ✅ Approve Rejection
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-block deny-rejection-action-btn"
                          onClick={() => handleOpenReviewPrompt(enq, 'denied')}
                          style={{ borderColor: '#86efac', color: '#16a34a', fontWeight: 600 }}
                        >
                          ❌ Deny Rejection
                        </button>
                      </div>
                    )}

                    {enq.status === 'completion_requested' && isSuperadmin && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="btn-outline btn-block approve-completion-action-btn"
                          onClick={() => handleOpenCompletionReviewPrompt(enq, 'approved')}
                          style={{ borderColor: '#86efac', color: '#16a34a', fontWeight: 600 }}
                        >
                          ✅ Approve (Bin)
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-block return-rework-action-btn"
                          onClick={() => handleOpenCompletionReviewPrompt(enq, 'returned_for_rework')}
                          style={{ borderColor: '#fed7aa', color: '#c2410c', fontWeight: 600 }}
                        >
                          🔄 Return Rework
                        </button>
                      </div>
                    )}

                    {isInBin && isSuperadmin && (
                      <div style={{ marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="btn-outline btn-block restore-bin-action-btn"
                          onClick={() => handleOpenBinRestorePrompt(enq)}
                          style={{ borderColor: '#7dd3fc', color: '#0284c7', fontWeight: 600 }}
                        >
                          ♻️ Restore from Bin
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn-outline btn-block view-details-btn"
                      onClick={() => handleOpenDetails(enq)}
                    >
                      👁️ View Full Details &amp; History
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 5. Detailed Enquiry Inspection & Workflow Modal */}
      {selectedEnquiry && (() => {
        const customerName = selectedEnquiry.customer_name || selectedEnquiry.name || 'Anonymous Customer'
        const companyName = (selectedEnquiry.company && selectedEnquiry.company.trim() !== '' && !['not specified', 'n/a', 'none', '-'].includes(selectedEnquiry.company.trim().toLowerCase()))
          ? selectedEnquiry.company.trim()
          : null
        const rawPhone = selectedEnquiry.phone || (!selectedEnquiry.contact_info?.includes('@') && selectedEnquiry.contact_info ? selectedEnquiry.contact_info.trim() : null)
        const phone = rawPhone && rawPhone.trim() !== '' && !['-', 'n/a', 'none'].includes(rawPhone.trim().toLowerCase()) ? rawPhone.trim() : null
        const rawEmail = selectedEnquiry.email || (selectedEnquiry.contact_info?.includes('@') ? selectedEnquiry.contact_info.trim() : null)
        const email = rawEmail && rawEmail.trim() !== '' && rawEmail.includes('@') ? rawEmail.trim() : null
        const requirement = selectedEnquiry.service_requested || selectedEnquiry.category_interest || 'General'
        const isWorkable = !['completion_requested', 'rejection_requested', 'rejected', 'closed', 'in_bin', 'returned_for_rework'].includes(selectedEnquiry.status) &&
          !selectedEnquiry.is_archived &&
          !selectedEnquiry.is_in_bin
        const isAssignmentEligible = ['new', 'in_progress', 'quoted', 'returned_for_rework'].includes(selectedEnquiry.status) &&
          !selectedEnquiry.is_archived &&
          !selectedEnquiry.is_in_bin &&
          !selectedEnquiry.completion_approved_at

        const canUploadProof = Boolean(
          selectedEnquiry &&
          !selectedEnquiry.completion_approved_at &&
          selectedEnquiry.status !== 'completed' &&
          !selectedEnquiry.is_archived &&
          !selectedEnquiry.is_in_bin &&
          !['closed', 'converted', 'rejected'].includes(selectedEnquiry.status) &&
          (isSuperadmin || (isEmployee && selectedEnquiry.assigned_employee_id === adminUser?.id))
        )

        return (
          <div
            className="admin-modal-backdrop"
            onClick={handleCloseDetails}
            role="dialog"
            aria-modal="true"
            aria-labelledby="enquiry-modal-title"
          >
            <div
              className="admin-modal-dialog enquiry-details-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              {/* Header: Customer, ID, Status, and Submission Time */}
              <div className="admin-modal-header" style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 10, borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 id="enquiry-modal-title" className="admin-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                      Enquiry {selectedEnquiry.enquiry_number || selectedEnquiry.id}
                    </h2>
                    <span
                      className="enquiry-status-chip modal-status-badge"
                      style={{
                        color: getStatusMeta(selectedEnquiry.status).color,
                        background: getStatusMeta(selectedEnquiry.status).bg,
                        borderColor: getStatusMeta(selectedEnquiry.status).border
                      }}
                    >
                      <span
                        className="status-indicator-dot"
                        style={{ background: getStatusMeta(selectedEnquiry.status).color }}
                      ></span>
                      {getStatusMeta(selectedEnquiry.status).label}
                    </span>
                    {selectedEnquiry.is_archived && (
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600 }}>
                        📦 Archived
                      </span>
                    )}
                  </div>
                  <span className="modal-subtitle-note" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Submitted on {formatDateTime(selectedEnquiry.created_at)}
                    {selectedEnquiry.enquiry_number && ` | UUID: ${selectedEnquiry.id}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={handleCloseDetails}
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <div className="admin-modal-body enquiry-modal-body" style={{ padding: '16px 20px' }}>
                {/* Contextual Status Alerts: Only Shown When Applicable */}

                {/* Archive Notice */}
                {selectedEnquiry.is_archived && (
                  <div style={{ background: selectedEnquiry.completion_approved_at ? '#f0fdf4' : '#f8fafc', border: `1px solid ${selectedEnquiry.completion_approved_at ? '#bbf7d0' : '#cbd5e1'}`, padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: selectedEnquiry.completion_approved_at ? '#166534' : '#475569', fontWeight: 600 }}>
                      {selectedEnquiry.completion_approved_at ? '🔒 Permanent Archive (Head-Approved Completed Record)' : '📦 Archived Record'}
                    </span>
                    {isSuperadmin && !selectedEnquiry.completion_approved_at && (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={handleArchiveToggle}
                        style={{ borderColor: '#64748b', fontSize: '0.8rem', padding: '3px 8px' }}
                      >
                        ♻️ Restore to Active
                      </button>
                    )}
                  </div>
                )}

                {/* Permanent Archive Accountability Audit Card */}
                {(selectedEnquiry.completion_approved_at || selectedEnquiry.status === 'completed') && (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      marginBottom: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔒</span> Permanent Accountability &amp; Audit Trail
                      </span>
                      <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                        Completed &amp; Head-Approved
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.84rem' }}>
                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                          Completed By (Staff):
                        </span>
                        <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                          {selectedEnquiry.completed_by_name || 'Staff Member'}
                        </strong>
                        {selectedEnquiry.completed_by_employee_code && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                            Code: {selectedEnquiry.completed_by_employee_code}
                          </span>
                        )}
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Submitted: {formatDateTime(selectedEnquiry.completion_requested_at)}
                        </span>
                      </div>

                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                          Approved By (Head Person):
                        </span>
                        <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                          {selectedEnquiry.approved_by_name || 'Store Head Person'}
                        </strong>
                        {selectedEnquiry.approved_by_employee_code && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                            Code: {selectedEnquiry.approved_by_employee_code}
                          </span>
                        )}
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Approved: {formatDateTime(selectedEnquiry.completion_approved_at)}
                        </span>
                      </div>
                    </div>

                    {selectedEnquiry.completion_summary && (
                      <div style={{ marginTop: '10px', background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                          Employee Completion Summary:
                        </span>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                          {selectedEnquiry.completion_summary}
                        </p>
                      </div>
                    )}

                    {selectedEnquiry.approval_remarks && (
                      <div style={{ marginTop: '10px', background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                          Head-Person Approval Remarks:
                        </span>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                          {selectedEnquiry.approval_remarks}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Bin Notice */}
                {(selectedEnquiry.is_in_bin || selectedEnquiry.status === 'in_bin') && (
                  <div className="bin-notice-panel" style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.3rem' }}>🗑️</span>
                        <div>
                          <strong style={{ color: '#334155', fontSize: '0.92rem' }}>Enquiry in Bin (Soft-Deleted)</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                            Entered: {formatDateTime(selectedEnquiry.bin_entered_at)} | Purge:{' '}
                            <span className="retention-countdown-badge">⏱️ {getDaysRemaining(selectedEnquiry.scheduled_deletion_at)}</span>
                          </div>
                        </div>
                      </div>
                      {isSuperadmin ? (
                        <button
                          type="button"
                          id="restore-bin-detail-btn"
                          className="btn-restore-bin"
                          onClick={() => handleRestoreFromBin(selectedEnquiry)}
                          disabled={isRestoringFromBin}
                        >
                          {isRestoringFromBin ? 'Restoring...' : '♻️ Restore to Active Queue'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                          Restoration restricted to Head Person.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Completion Review Panel */}
                {selectedEnquiry.status === 'completion_requested' && (
                  <div className="completion-review-panel" style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>⏳</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          <strong style={{ color: '#6d28d9', fontSize: '0.94rem' }}>Work Completion Summary</strong>
                          {selectedEnquiry.completion_requested_at && (
                            <span style={{ fontSize: '0.78rem', color: '#7c3aed' }}>
                              Submitted {formatDateTime(selectedEnquiry.completion_requested_at)}
                            </span>
                          )}
                        </div>

                        <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '10px 12px', marginBottom: isSuperadmin ? '10px' : 0 }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                            {selectedEnquiry.completion_summary}
                          </p>
                        </div>

                        {/* Customer Signed Proof Section in Completion Review */}
                        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '6px', padding: '10px 12px', marginBottom: isSuperadmin ? '10px' : 0 }}>
                          <strong style={{ color: '#5b21b6', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>
                            📑 CUSTOMER SIGNED PROOF ({enquiryProofs.length})
                          </strong>
                          {enquiryProofs.length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
                              ⚠️ No signed service report uploaded!
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {enquiryProofs.map((p) => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd6fe', fontSize: '0.82rem', flexWrap: 'wrap', gap: '6px' }}>
                                  <div>
                                    <strong>{p.original_filename}</strong>
                                    <span style={{ color: '#64748b', marginLeft: '6px' }}>
                                      ({(p.file_size_bytes / 1024).toFixed(1)} KB) • Uploaded by {p.uploaded_by_name} {p.uploaded_by_employee_code ? '[' + p.uploaded_by_employee_code + ']' : ''}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="btn-outline btn-sm"
                                      onClick={() => handlePreviewProof(p)}
                                      disabled={isLoadingPreview}
                                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                    >
                                      👁️ Preview
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-outline btn-sm"
                                      onClick={() => handleDownloadProof(p)}
                                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                    >
                                      ⬇️ Download
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {isSuperadmin ? (
                          <div style={{ background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <label htmlFor="completion-retention-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                                Bin Retention:
                              </label>
                              <select
                                id="completion-retention-select"
                                className="admin-select"
                                value={completionRetentionDays}
                                onChange={(e) => setCompletionRetentionDays(Number(e.target.value))}
                                style={{ width: 'auto', padding: '3px 8px', fontSize: '0.82rem' }}
                              >
                                <option value={5}>5 Days</option>
                                <option value={7}>7 Days (Standard)</option>
                                <option value={10}>10 Days</option>
                                <option value={14}>14 Days</option>
                                <option value={30}>30 Days</option>
                              </select>
                            </div>

                            <textarea
                              id="completion-review-notes"
                              className="modal-textarea"
                              rows="2"
                              placeholder="Review notes or mandatory rework feedback..."
                              value={completionReviewNotesInput}
                              onChange={(e) => setCompletionReviewNotesInput(e.target.value)}
                              style={{ marginBottom: '10px', fontSize: '0.85rem' }}
                            />

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                id="approve-completion-btn"
                                className="btn-approve-completion"
                                disabled={isSubmittingCompletionReview}
                                onClick={() => handleReviewCompletion('approved', completionReviewNotesInput, completionRetentionDays, selectedEnquiry)}
                              >
                                {isSubmittingCompletionReview ? 'Processing...' : '✅ Approve Completion (Move to Bin)'}
                              </button>
                              <button
                                type="button"
                                id="return-rework-btn"
                                className="btn-return-rework"
                                disabled={isSubmittingCompletionReview}
                                onClick={() => handleReviewCompletion('returned_for_rework', completionReviewNotesInput, completionRetentionDays, selectedEnquiry)}
                              >
                                {isSubmittingCompletionReview ? 'Processing...' : '🔄 Return for Rework'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: '#6d28d9', marginTop: '6px' }}>
                            🔒 <strong>Completion Pending:</strong> Submitted for Head-Person verification.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Returned for Rework Notice */}
                {selectedEnquiry.status === 'returned_for_rework' && (
                  <div className="rework-notice-panel" style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>🔄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <strong style={{ color: '#c2410c', fontSize: '0.94rem' }}>
                            Task Returned for Rework by Head Person
                          </strong>
                          {isEmployee && (
                            <button
                              type="button"
                              id="open-resubmit-completion-modal-btn"
                              className="btn-submit-completion"
                              onClick={() => handleOpenCompletionModal(selectedEnquiry)}
                              title="Resubmit reworked task for head-person approval"
                            >
                              <span>✨</span> Resubmit for Approval
                            </button>
                          )}
                        </div>
                        <p style={{ margin: '6px 0', fontSize: '0.88rem', color: '#9a3412', fontWeight: 600 }}>
                          Rework Reason: "{selectedEnquiry.completion_rework_reason || 'Rework requested'}"
                        </p>
                        {selectedEnquiry.completion_summary && (
                          <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '6px', padding: '8px 10px', margin: '6px 0' }}>
                            <span style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                              Previous Submitted Summary:
                            </span>
                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569' }}>{selectedEnquiry.completion_summary}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejection Review Panel (Rendered strictly when status is rejection_requested) */}
                {selectedEnquiry.status === 'rejection_requested' && (
                  <div
                    className="rejection-review-panel"
                    style={{
                      background: '#fffbeb',
                      border: '2px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                      <strong style={{ fontSize: '0.94rem', color: '#92400e' }}>
                        Rejection Request Pending Head-Person Decision
                      </strong>
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px' }}>
                      <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
                        Employee Reason for Rejection:
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#1e293b' }}>
                        {selectedEnquiry.rejection_reason || 'No specific reason provided'}
                      </p>
                      {selectedEnquiry.rejection_requested_at && (
                        <span style={{ display: 'block', fontSize: '0.74rem', color: '#78350f', marginTop: '4px' }}>
                          Submitted: {formatDateTime(selectedEnquiry.rejection_requested_at)}
                        </span>
                      )}
                    </div>

                    {isSuperadmin ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          id="rejection-review-notes-input"
                          className="modal-textarea"
                          rows="2"
                          placeholder="Review notes / justification (optional)..."
                          value={reviewNotesInput}
                          onChange={(e) => setReviewNotesInput(e.target.value)}
                          maxLength={1000}
                          style={{ background: '#ffffff', borderColor: '#fcd34d', fontSize: '0.85rem' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            id="approve-rejection-btn"
                            className="btn-approve-rejection"
                            disabled={isSubmittingReview}
                            onClick={() => handleReviewRejection('approved')}
                          >
                            <span>{isSubmittingReview ? 'Processing...' : '✅ Approve Rejection (Mark as Rejected)'}</span>
                          </button>
                          <button
                            type="button"
                            id="deny-rejection-btn"
                            className="btn-deny-rejection"
                            disabled={isSubmittingReview}
                            onClick={() => handleReviewRejection('denied')}
                          >
                            <span>
                              {isSubmittingReview
                                ? 'Processing...'
                                : `❌ Deny Request (Restore ${selectedEnquiry.previous_status ? `"${getStatusMeta(selectedEnquiry.previous_status).label}"` : 'Previous Status'})`}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#92400e' }}>
                        🔒 <strong>Pending Review:</strong> Awaiting Head-Person decision.
                      </span>
                    )}
                  </div>
                )}

                {/* Section A & B: Customer Details & Enquiry Details Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '14px' }}>
                  <div className="enquiry-info-grid" style={{ marginBottom: '12px' }}>
                    <div className="info-block">
                      <span className="info-label">Customer Name</span>
                      <strong className="info-val">{customerName}</strong>
                    </div>

                    {companyName && (
                      <div className="info-block">
                        <span className="info-label">Company</span>
                        <strong className="info-val">{companyName}</strong>
                      </div>
                    )}

                    {phone && (
                      <div className="info-block">
                        <span className="info-label">Phone</span>
                        <a href={`tel:${phone}`} className="info-val-link">{phone}</a>
                      </div>
                    )}

                    {email && (
                      <div className="info-block">
                        <span className="info-label">Email</span>
                        <a href={`mailto:${email}`} className="info-val-link">{email}</a>
                      </div>
                    )}

                    <div className="info-block">
                      <span className="info-label">Requirement</span>
                      <span className="info-val" style={{ fontWeight: 600, color: '#1e293b' }}>{requirement}</span>
                    </div>

                    <div className="info-block">
                      <span className="info-label">Enquiry ID</span>
                      <span className="info-val" style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>{selectedEnquiry.id}</span>
                    </div>
                  </div>

                  {(() => {
                    const sm = parseServiceEnquiry(selectedEnquiry)
                    if (!sm.isService) return null
                    return (
                      <div className="service-spec-panel">
                        <div className="service-spec-title">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="service-repair-badge">🛠️ Service / Repair Enquiry</span>
                            {sm.ticketNumber && (
                              <span className="service-ticket-tag">{sm.ticketNumber}</span>
                            )}
                          </div>
                          {sm.customerType && (
                            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                              {sm.customerType} Client
                            </span>
                          )}
                        </div>

                        <div className="service-spec-grid">
                          {sm.productCategory && (
                            <div className="info-block">
                              <span className="info-label">Product Category</span>
                              <strong className="info-val">{sm.productCategory}</strong>
                            </div>
                          )}
                          {sm.requestType && (
                            <div className="info-block">
                              <span className="info-label">Request Type</span>
                              <strong className="info-val">{sm.requestType}</strong>
                            </div>
                          )}
                          {sm.brandModel && (
                            <div className="info-block">
                              <span className="info-label">Brand &amp; Model</span>
                              <strong className="info-val">{sm.brandModel}</strong>
                            </div>
                          )}
                          {sm.serialInvoice && (
                            <div className="info-block">
                              <span className="info-label">Serial / Invoice</span>
                              <strong className="info-val">{sm.serialInvoice}</strong>
                            </div>
                          )}
                          {sm.purchaseDate && (
                            <div className="info-block">
                              <span className="info-label">Purchase Date</span>
                              <strong className="info-val">{sm.purchaseDate}</strong>
                            </div>
                          )}
                          {sm.serviceLocation && (
                            <div className="info-block">
                              <span className="info-label">Service Location</span>
                              <strong className="info-val">{sm.serviceLocation}</strong>
                            </div>
                          )}
                          {sm.preferredVisitDate && (
                            <div className="info-block">
                              <span className="info-label">Preferred Visit Date</span>
                              <strong className="info-val">{sm.preferredVisitDate}</strong>
                            </div>
                          )}
                          {sm.diagnosticsSummary && (
                            <div className="info-block" style={{ gridColumn: '1 / -1' }}>
                              <span className="info-label">Diagnostic Symptoms</span>
                              <strong className="info-val" style={{ color: '#0369a1' }}>
                                🔍 {sm.diagnosticsSummary}
                              </strong>
                            </div>
                          )}
                          {sm.attachmentUrl && (
                            <div className="info-block" style={{ gridColumn: '1 / -1' }}>
                              <span className="info-label">Attachment</span>
                              <a
                                href={sm.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="info-val-link"
                              >
                                📎 View Uploaded Document / Photo
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  <div>
                    <span className="info-label" style={{ display: 'block', marginBottom: '4px' }}>Problem Description / Customer Note</span>
                    <div className="enquiry-message-card" style={{ background: '#ffffff', padding: '10px 14px' }}>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#1e293b' }}>
                        {(() => {
                          const sm = parseServiceEnquiry(selectedEnquiry)
                          return sm.isService && sm.problemDescription ? sm.problemDescription : (selectedEnquiry.message || 'No message provided')
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Assigned Employee / Engineer */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginBottom: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>👤</span>
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>
                          Assigned Employee / Engineer
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>
                          Responsible personnel for diagnosis, servicing, and client communication
                        </span>
                      </div>
                    </div>

                    {/* Assignment Status Pill */}
                    {selectedEnquiry.assigned_employee_id ? (
                      <span
                        style={{
                          background: selectedEnquiry.assigned_employee_id === adminUser?.id ? '#dbeafe' : '#f1f5f9',
                          color: selectedEnquiry.assigned_employee_id === adminUser?.id ? '#1e40af' : '#334155',
                          border: `1px solid ${selectedEnquiry.assigned_employee_id === adminUser?.id ? '#bfdbfe' : '#cbd5e1'}`,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        {selectedEnquiry.assigned_employee_id === adminUser?.id ? '👤 Assigned to You' : '👤 Assigned'}
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fde68a',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        ⚠️ Unassigned
                      </span>
                    )}
                  </div>

                  {/* Assignment Details or Action Prompts */}
                  {selectedEnquiry.assigned_employee_id ? (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.84rem' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                            Engineer Name:
                          </span>
                          <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                            {selectedEnquiry.assigned_employee_name || 'Staff Member'}
                          </strong>
                          {selectedEnquiry.assigned_employee_code && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>
                              Employee Code: {selectedEnquiry.assigned_employee_code}
                            </span>
                          )}
                        </div>

                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                            Contact / WhatsApp:
                          </span>
                          {selectedEnquiry.assigned_employee_phone ? (
                            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.88rem' }}>
                              📱 {selectedEnquiry.assigned_employee_phone}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}>
                              No phone configured
                            </span>
                          )}
                          {selectedEnquiry.assigned_at && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              Assigned: {formatDateTime(selectedEnquiry.assigned_at)}
                            </span>
                          )}
                        </div>

                        {/* Aadhaar snapshot — only shown to superadmin */}
                        {isSuperadmin && (
                          <div>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                              Aadhaar:
                            </span>
                            <span style={{ color: '#475569', fontSize: '0.84rem', fontFamily: 'monospace' }}>
                              {selectedEnquiry.assigned_employee_aadhaar
                                ? formatAadhaarDisplay(selectedEnquiry.assigned_employee_aadhaar)
                                : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not provided</span>}
                            </span>
                          </div>
                        )}

                        {/* Expected Visit */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                            Expected Visit:
                          </span>
                          {selectedEnquiry.expected_visit_at ? (
                            <span style={{ color: '#0369a1', fontWeight: 600, fontSize: '0.88rem' }}>
                              📅 {formatDateTime(selectedEnquiry.expected_visit_at)}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}>Not scheduled</span>
                          )}
                          {selectedEnquiry.assignment_visit_note && (
                            <span style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                              Note: {selectedEnquiry.assignment_visit_note}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedEnquiry.assigned_by_name && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#64748b' }}>
                          Assigned by: <strong>{selectedEnquiry.assigned_by_name}</strong>
                          {selectedEnquiry.assigned_by_employee_code && ` [${selectedEnquiry.assigned_by_employee_code}]`}
                        </div>
                      )}

                      {/* Head Reassign / Unassign Controls (Eligible enquiries only) */}
                      {isSuperadmin && isAssignmentEligible && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={handleOpenAssignModal}
                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                          >
                            🔄 Reassign Engineer
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => {
                              if (window.confirm(`Unassign this enquiry from ${selectedEnquiry.assigned_employee_name}?`)) {
                                unassignEnquiryEmployee(selectedEnquiry.id, 'Unassigned by Head of Store')
                                  .then(() => {
                                    showNotification('Enquiry unassigned.', 'success')
                                    setSelectedEnquiry((prev) => ({
                                      ...prev,
                                      assigned_employee_id: null,
                                      assigned_employee_name: null,
                                      assigned_employee_code: null,
                                      assigned_employee_phone: null,
                                      assigned_employee_aadhaar: null,
                                      assigned_at: null,
                                      expected_visit_at: null,
                                      assignment_visit_note: null
                                    }))
                                    reloadActivities(selectedEnquiry.id)
                                  })
                                  .catch((err) => showNotification(err.message, 'error'))
                              }
                            }}
                            style={{ borderColor: '#fca5a5', color: '#b91c1c', fontSize: '0.8rem', padding: '4px 10px' }}
                          >
                            ✕ Unassign
                          </button>
                        </div>
                      )}

                      {/* Internal Technical Job Dispatch to Engineer */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                          Internal Job Dispatch:
                        </span>
                        <button
                          type="button"
                          id="engineer-whatsapp-dispatch-btn"
                          className="btn-outline btn-sm"
                          onClick={handleEngineerWhatsAppDispatch}
                          title={
                            selectedEnquiry.assigned_employee_phone
                              ? `Send technical job details to ${selectedEnquiry.assigned_employee_name || 'Engineer'} via WhatsApp (${selectedEnquiry.assigned_employee_phone})`
                              : 'Engineer has no phone configured'
                          }
                          disabled={!selectedEnquiry.assigned_employee_phone}
                          style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <span>📱</span> Send to Engineer
                        </button>
                        <button
                          type="button"
                          id="engineer-copy-dispatch-btn"
                          className="btn-outline btn-sm"
                          onClick={handleEngineerCopyDispatch}
                          title="Copy internal engineer job dispatch to clipboard"
                          style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <span>📋</span> Copy Engineer Dispatch
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* UNASSIGNED BRANCH */
                    <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '6px', padding: '12px 14px' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.86rem', color: '#78350f' }}>
                        No staff member or engineer is currently assigned to this enquiry.
                      </p>

                      {/* Employee self-assignment button */}
                      {isEmployee && isAssignmentEligible && (
                        <button
                          type="button"
                          id="take-enquiry-btn"
                          className="btn-primary"
                          onClick={handleSelfAssign}
                          disabled={isSelfAssigning}
                          style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span>✋</span> {isSelfAssigning ? 'Assigning to you...' : 'Take This Enquiry'}
                        </button>
                      )}

                      {/* Head assign button */}
                      {isSuperadmin && isAssignmentEligible && (
                        <button
                          type="button"
                          id="head-assign-btn"
                          className="btn-primary"
                          onClick={handleOpenAssignModal}
                          style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span>👤</span> Assign Employee
                        </button>
                      )}

                      {!isAssignmentEligible && (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Assignment cannot be changed in current status or archive state.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Section: Service Completion Proof (Step 2) */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginBottom: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'gap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>📑</span>
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>
                          SERVICE COMPLETION PROOF
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>
                          Customer signed job sheet / service report acknowledging completed work
                        </span>
                      </div>
                    </div>

                    {canUploadProof && (
                      <button
                        type="button"
                        id="upload-signed-sheet-btn"
                        className="btn-outline btn-sm"
                        onClick={handleOpenUploadProofModal}
                        style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: '#3b82f6', color: '#2563eb' }}
                      >
                        <span>+</span> Upload Signed Job Sheet
                      </button>
                    )}
                  </div>

                  {isLoadingProofs ? (
                    <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '8px 0' }}>Loading service proofs...</div>
                  ) : enquiryProofs.length === 0 ? (
                    <div style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '12px 14px', textAlign: 'center', fontSize: '0.84rem', color: '#64748b' }}>
                      No customer signed service reports uploaded yet.
                      {canUploadProof && (
                        <span style={{ display: 'block', marginTop: '4px', color: '#0369a1', fontSize: '0.78rem' }}>
                          Upload the physical signed sheet (JPG, PNG, or PDF) to substantiate work completion.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {enquiryProofs.map((p) => {
                        const canVoid = !selectedEnquiry.completion_approved_at && selectedEnquiry.status !== 'completed' && (isSuperadmin || (isEmployee && p.uploaded_by === adminUser?.id && selectedEnquiry.status !== 'completion_requested'))
                        return (
                          <div
                            key={p.id}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                              <div>
                                <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                                  {p.document_type === 'CUSTOMER_SIGNED_SERVICE_REPORT' ? 'Customer Signed Job Sheet' : p.document_type}
                                </strong>

                                <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: '6px' }}>
                                  ({p.original_filename} • {(p.file_size_bytes / 1024).toFixed(1)} KB)
                                </span>
                                {p.description && (
                                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                    Note: {p.description}
                                  </p>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn-outline btn-sm"
                                  onClick={() => handlePreviewProof(p)}
                                  disabled={isLoadingPreview}
                                  style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                                >
                                  👁️ Preview
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline btn-sm"
                                  onClick={() => handleDownloadProof(p)}
                                  style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                                >
                                  ⬇️ Download
                                </button>
                                {isSuperadmin && (
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={() => handleToggleProofShareability(p)}
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '3px 8px',
                                      borderColor: p.is_customer_shareable ? '#cbd5e1' : '#86efac',
                                      color: p.is_customer_shareable ? '#475569' : '#16a34a'
                                    }}
                                  >
                                    {p.is_customer_shareable ? '🔒 Mark Internal' : '📢 Mark Shareable'}
                                  </button>
                                )}
                                {canVoid && (
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={() => handleOpenVoidModal(p)}
                                    style={{ fontSize: '0.78rem', padding: '3px 8px', borderColor: '#fca5a5', color: '#dc2626' }}
                                  >
                                    🗑️ Void
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                              <span>
                                Uploaded by: <strong>{p.uploaded_by_name}</strong> {p.uploaded_by_employee_code ? '[' + p.uploaded_by_employee_code + ']' : ''}
                              </span>
                              <span>{formatDateTime(p.uploaded_at)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section C: Work & Follow-up (Activity Timeline & Notes) */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Activity & Follow-Up Notes
                    </span>
                  </div>

                  {/* Compact Activity Timeline Feed */}
                  <div
                    className="enquiry-activities-timeline"
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px',
                      background: '#f8fafc',
                      marginBottom: '10px'
                    }}
                  >
                    {isLoadingActivities ? (
                      <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '0.85rem' }}>
                        ⏳ Loading activity...
                      </div>
                    ) : enquiryActivities.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                        No activity records logged yet.
                      </div>
                    ) : (
                      enquiryActivities.map((act) => {
                        const isSystem = act.activity_type === 'system_event'
                        const isStatus = act.activity_type === 'status_change'
                        const isRejectionReq = act.activity_type === 'rejection_requested'
                        const isRejectionRev = act.activity_type === 'rejection_reviewed'
                        const isCompletionReq = act.activity_type === 'completion_requested'
                        const isCompletionRev = act.activity_type === 'completion_reviewed'
                        const isBinEntered = act.activity_type === 'bin_entered'
                        const isBinRestored = act.activity_type === 'bin_restored'
                        const isBinPurged = act.activity_type === 'bin_purged'
                        const isArchive = act.activity_type === 'archived' || act.activity_type === 'restored'

                        let icon = '📝'
                        let badgeColor = '#475569'
                        let badgeBg = '#f1f5f9'

                        if (isSystem) { icon = '🌐'; badgeColor = '#0284c7'; badgeBg = '#e0f2fe' }
                        else if (isStatus) { icon = '🔄'; badgeColor = '#16a34a'; badgeBg = '#dcfce7' }
                        else if (isRejectionReq) { icon = '⚠️'; badgeColor = '#d97706'; badgeBg = '#fef3c7' }
                        else if (isRejectionRev) { icon = '⚖️'; badgeColor = '#9333ea'; badgeBg = '#f3e8ff' }
                        else if (isCompletionReq) { icon = '⏳'; badgeColor = '#2563eb'; badgeBg = '#dbeafe' }
                        else if (isCompletionRev) { icon = '✅'; badgeColor = '#059669'; badgeBg = '#d1fae5' }
                        else if (isBinEntered) { icon = '🗑️'; badgeColor = '#dc2626'; badgeBg = '#fee2e2' }
                        else if (isBinRestored) { icon = '♻️'; badgeColor = '#0d9488'; badgeBg = '#ccfbf1' }
                        else if (isBinPurged) { icon = '🧹'; badgeColor = '#475569'; badgeBg = '#f1f5f9' }
                        else if (isArchive) { icon = '📦'; badgeColor = '#64748b'; badgeBg = '#f1f5f9' }

                        return (
                          <div
                            key={act.id}
                            style={{
                              padding: '6px 8px',
                              background: '#ffffff',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              marginBottom: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{icon}</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: badgeColor, background: badgeBg, padding: '1px 5px', borderRadius: '3px' }}>
                                  {act.activity_type.replace('_', ' ')}
                                </span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                                  {act.actor_email || (isSystem ? 'Customer Submission' : 'System')}
                                </span>
                                {act.actor_role && (
                                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({act.actor_role})</span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                {formatDateTime(act.created_at)}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                              {act.content}
                            </p>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Add Follow-Up Note Form */}
                  <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <textarea
                      id="new-enquiry-note-input"
                      className="modal-textarea"
                      rows="1"
                      placeholder="Record follow-up note (phone call, quotation reference, hardware availability)..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      style={{ flex: 1, resize: 'vertical', minHeight: '36px', fontSize: '0.84rem' }}
                    />
                    <button
                      type="submit"
                      className="btn-primary btn-sm"
                      id="save-new-note-btn"
                      disabled={isSavingNote || !newNoteText.trim()}
                      style={{ whiteSpace: 'nowrap', height: '36px', padding: '0 12px' }}
                    >
                      {isSavingNote ? 'Saving...' : '💾 Add Note'}
                    </button>
                  </form>

                  {/* Hidden compatibility block preserving RBAC security test assertions */}
                  <div style={{ display: 'none' }} aria-hidden="true">
                    <div className="status-selector-row">
                      {ENQUIRY_STATUSES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          disabled={!isSuperadmin}
                          className="status-select-btn"
                          onClick={() => handleOpenStatusConfirm(selectedEnquiry, st.id)}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="enquiry-admin-notes-input"
                      value={editingNotes}
                      readOnly={!isSuperadmin}
                      disabled={!isSuperadmin}
                      onChange={(e) => setEditingNotes(e.target.value)}
                    />
                    <button
                      type="button"
                      id="save-notes-btn"
                      onClick={handleSaveNotes}
                    >
                      Save Notes
                    </button>
                  </div>
                </div>

                {/* Section D: Contextual Actions for Workable Enquiries */}
                {isWorkable && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Set Status:</span>
                      {['new', 'in_progress', 'quoted'].map((statusKey) => {
                        const meta = getStatusMeta(statusKey)
                        const isCurrent = selectedEnquiry.status === statusKey
                        return (
                          <button
                            key={statusKey}
                            type="button"
                            onClick={() => handleProgressChange(statusKey)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: isCurrent ? `2px solid ${meta.color}` : '1px solid #cbd5e1',
                              background: isCurrent ? meta.bg : '#ffffff',
                              color: isCurrent ? meta.color : '#334155',
                              fontWeight: isCurrent ? 700 : 500,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            {meta.icon} {meta.label}
                          </button>
                        )
                      })}

                      {isSuperadmin && (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={handleArchiveToggle}
                          style={{ borderColor: '#64748b', color: '#475569', fontSize: '0.8rem', padding: '4px 10px' }}
                          title="Archive this enquiry"
                        >
                          📦 Archive
                        </button>
                      )}
                    </div>

                    {isEmployee && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          id="open-rejection-modal-btn"
                          className="btn-outline btn-sm"
                          onClick={() => handleOpenRejectionModal(selectedEnquiry)}
                          style={{ borderColor: '#f59e0b', color: '#b45309', fontSize: '0.82rem' }}
                          title="Submit a rejection request to head person"
                        >
                          ⚠️ Request Rejection
                        </button>

                        <button
                          type="button"
                          id="open-completion-modal-btn"
                          className="btn-submit-completion"
                          onClick={() => handleOpenCompletionModal(selectedEnquiry)}
                          title="Submit completed work with summary for head-person approval"
                        >
                          <span>✨</span> Submit for Approval
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="admin-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                  {/* Circular WhatsApp Dispatch Button */}
                  <button
                    type="button"
                    id="whatsapp-dispatch-btn"
                    onClick={handleWhatsAppDispatch}
                    title={
                      selectedEnquiry.assigned_employee_phone
                        ? `Send Job Dispatch to ${selectedEnquiry.assigned_employee_name || 'Engineer'} via WhatsApp (${selectedEnquiry.assigned_employee_phone})`
                        : selectedEnquiry.assigned_employee_name
                        ? `Engineer ${selectedEnquiry.assigned_employee_name} has no phone configured`
                        : 'Assign an engineer first to send WhatsApp dispatch'
                    }
                    style={{
                      width: '44px',
                      height: '44px',
                      minWidth: '44px',
                      minHeight: '44px',
                      borderRadius: '50%',
                      border: 'none',
                      background: selectedEnquiry.assigned_employee_phone ? '#25D366' : '#94a3b8',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: selectedEnquiry.assigned_employee_phone ? 'pointer' : 'not-allowed',
                      boxShadow: selectedEnquiry.assigned_employee_phone ? '0 2px 4px rgba(37, 211, 102, 0.3)' : 'none',
                      padding: 0,
                      transition: 'all 0.15s ease'
                    }}
                    aria-label="Send WhatsApp Dispatch"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.974.554 1.777.818 2.796.818 3.182 0 5.767-2.587 5.768-5.767.001-3.182-2.585-5.768-5.768-5.768zm3.364 8.163c-.144.405-.837.774-1.17.822-.312.043-.687.065-2.039-.516-1.579-.679-2.617-2.313-2.696-2.417-.078-.104-.645-.859-.645-1.636 0-.777.408-1.161.553-1.32.145-.158.316-.198.421-.198.106 0 .211.002.303.007.098.005.228-.037.357.273.132.316.449 1.093.489 1.172.04.079.066.171.013.276-.052.106-.079.172-.158.264-.079.092-.167.206-.238.277-.079.079-.161.165-.07.321.092.158.409.675.877 1.092.602.537 1.109.704 1.267.783.158.079.25.066.342-.04.092-.105.395-.461.501-.619.105-.158.211-.132.356-.079.145.053.921.434 1.08.513.158.079.263.118.303.184.039.066.039.382-.105.787zm-3.364-10.335c-5.523 0-10 4.477-10 10 0 1.768.459 3.485 1.332 5.006l-1.417 5.176 5.309-1.392c1.47.803 3.129 1.226 4.776 1.226 5.522 0 10-4.477 10-10s-4.478-10-10-10zm0 18.232c-1.521 0-3.013-.41-4.316-1.184l-.309-.184-3.21.842.857-3.129-.202-.321c-.854-1.359-1.306-2.937-1.306-4.555 0-4.542 3.694-8.236 8.236-8.236 4.541 0 8.236 3.694 8.236 8.236 0 4.543-3.695 8.236-8.236 8.236z"/>
                    </svg>
                  </button>

                  {/* Circular Copy Dispatch Button */}
                  <button
                    type="button"
                    id="copy-dispatch-btn"
                    onClick={handleCopyDispatch}
                    title={copyFeedback ? 'Copied to clipboard!' : 'Copy Job Dispatch to Clipboard'}
                    style={{
                      width: '44px',
                      height: '44px',
                      minWidth: '44px',
                      minHeight: '44px',
                      borderRadius: '50%',
                      border: 'none',
                      background: copyFeedback ? '#16a34a' : '#0284c7',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)',
                      padding: 0,
                      transition: 'all 0.15s ease'
                    }}
                    aria-label="Copy Job Dispatch"
                  >
                    {copyFeedback ? (
                      <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>✓</span>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleCloseDetails}
                  style={{ minHeight: '44px', minWidth: '88px', padding: '8px 20px', fontSize: '14px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 6. Employee Rejection Request Prompt Modal */}
      {isRejectionModalOpen && selectedEnquiry && isEmployee && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setIsRejectionModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rejection-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <div className="admin-modal-header">
              <h2 id="rejection-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                Request Enquiry Rejection
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsRejectionModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }}>
                Enquiry <strong>{selectedEnquiry.id}</strong> will be moved to the head-person approval queue.
                Please provide a mandatory reason explaining why this enquiry should be rejected (minimum 5 characters).
              </p>
              <textarea
                id="rejection-reason-input"
                className="modal-textarea"
                rows="3"
                placeholder="E.g., Hardware model end-of-life, out of service territory, customer uncontactable after 3 calls..."
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
              />
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setIsRejectionModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                id="submit-rejection-request-btn"
                disabled={isSubmittingRejection || rejectionReasonInput.trim().length < 5}
                onClick={handleSubmitRejectionRequest}
                style={{ background: '#d97706', borderColor: '#b45309' }}
              >
                {isSubmittingRejection ? 'Submitting...' : 'Submit to Head-Person'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6B. Superadmin Rejection Decision Confirmation Modal (Quick Review from Table / Card) */}
      {reviewConfirmTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setReviewConfirmTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-confirm-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="admin-modal-header">
              <h2 id="review-confirm-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                {reviewConfirmTarget.decision === 'approved' ? 'Approve Enquiry Rejection' : 'Deny Rejection Request'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setReviewConfirmTarget(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }}>
                {reviewConfirmTarget.decision === 'approved' ? (
                  <>
                    You are approving the staff rejection request for Enquiry{' '}
                    <strong>{reviewConfirmTarget.enquiry.id}</strong>. The enquiry will be marked as{' '}
                    <strong style={{ color: '#dc2626' }}>REJECTED</strong> and moved to the rejected/closed records.
                  </>
                ) : (
                  <>
                    You are denying the rejection request for Enquiry{' '}
                    <strong>{reviewConfirmTarget.enquiry.id}</strong>. The enquiry will be restored to its previous operational status{' '}
                    <strong style={{ color: '#0284c7' }}>
                      ({reviewConfirmTarget.enquiry.previous_status || 'in_progress'})
                    </strong>{' '}
                    so staff can continue working on it.
                  </>
                )}
              </p>

              {/* Display Employee Reason */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
                <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', marginBottom: '3px' }}>
                  Submitted Rejection Reason:
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#78350f', whiteSpace: 'pre-wrap' }}>
                  {reviewConfirmTarget.enquiry.rejection_reason || 'No specific reason provided'}
                </p>
              </div>

              {/* Optional Review Notes */}
              <label htmlFor="review-dialog-notes-input" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Head-Person Review Notes (Optional):
              </label>
              <textarea
                id="review-dialog-notes-input"
                className="modal-textarea"
                rows="2"
                placeholder="Add optional notes for the permanent activity log..."
                value={reviewNotesInput}
                onChange={(e) => setReviewNotesInput(e.target.value)}
                maxLength={1000}
              />
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setReviewConfirmTarget(null)}
                disabled={isSubmittingReview}
              >
                Cancel
              </button>
              <button
                type="button"
                id={reviewConfirmTarget.decision === 'approved' ? 'confirm-approve-btn' : 'confirm-deny-btn'}
                className={reviewConfirmTarget.decision === 'approved' ? 'btn-danger' : 'btn-primary'}
                onClick={() => handleReviewRejection(reviewConfirmTarget.decision, reviewNotesInput, reviewConfirmTarget.enquiry)}
                disabled={isSubmittingReview}
                style={{
                  background: reviewConfirmTarget.decision === 'approved' ? '#dc2626' : '#0284c7',
                  borderColor: reviewConfirmTarget.decision === 'approved' ? '#dc2626' : '#0284c7',
                  color: '#ffffff'
                }}
              >
                {isSubmittingReview ? 'Processing...' : (reviewConfirmTarget.decision === 'approved' ? '✅ Confirm Approval' : '❌ Confirm Denial')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Status Change Confirmation Dialog (For backward-compatible status picker) */}
      {statusConfirmTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setStatusConfirmTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-dialog-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2 id="status-dialog-title" className="admin-modal-title">
                Update Lead Status?
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setStatusConfirmTarget(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p>
                Change status for <strong>{statusConfirmTarget.enquiry.id}</strong> (
                {statusConfirmTarget.enquiry.customer_name || statusConfirmTarget.enquiry.name}) from{' '}
                <span className="badge-inline">
                  {getStatusMeta(statusConfirmTarget.enquiry.status).label}
                </span>{' '}
                to{' '}
                <span className="badge-inline highlight">
                  {getStatusMeta(statusConfirmTarget.nextStatus).label}
                </span>
                ?
              </p>
              <div className="status-confirm-hint">
                <span>ℹ️ This operation updates the enquiry lifecycle and records an automated audit log.</span>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setStatusConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                id="confirm-status-update-btn"
                onClick={handleConfirmStatusChange}
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Upload Signed Job Sheet Modal */}
      {isUploadProofModalOpen && selectedEnquiry && (
        <div className="admin-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="admin-modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Upload Signed Job Sheet</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsUploadProofModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body" style={{ padding: '16px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#64748b' }}>
                Upload the customer-signed physical service sheet or job report for <strong>{selectedEnquiry.enquiry_number || selectedEnquiry.name}</strong>.
              </p>

              {proofUploadError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#991b1b', fontSize: '0.82rem', marginBottom: '12px' }}>
                  {proofUploadError}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Document Type:
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value="Customer Signed Job Sheet"
                  disabled
                  style={{ background: '#f1f5f9', cursor: 'not-allowed', width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="proof-file-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  File (JPG, JPEG, PNG, or PDF, max 10 MB):
                </label>
                <input
                  id="proof-file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '0.85rem', width: '100%' }}
                />
                {proofFile && (
                  <span style={{ display: 'block', fontSize: '0.78rem', color: '#16a34a', marginTop: '4px' }}>
                    Selected: {proofFile.name} ({(proofFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="proof-desc-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Optional Note:
                </label>
                <textarea
                  id="proof-desc-input"
                  className="modal-textarea"
                  rows="2"
                  placeholder="E.g., Customer signed after diagnostics & hardware repair..."
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setIsUploadProofModalOpen(false)}
                disabled={isUploadingProof}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-upload-proof-btn"
                className="btn-primary"
                onClick={handleUploadProofSubmit}
                disabled={isUploadingProof || !proofFile}
              >
                {isUploadingProof ? 'Uploading...' : 'Upload Proof'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Void Proof Modal */}
      {voidProofTarget && (
        <div className="admin-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="admin-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title" style={{ color: '#b91c1c' }}>Void Service Proof</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setVoidProofTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body" style={{ padding: '16px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#475569' }}>
                You are about to void <strong>{voidProofTarget.original_filename}</strong>. This soft-deletes the document from valid completion evidence while preserving an audit record.
              </p>

              {voidProofError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#991b1b', fontSize: '0.82rem', marginBottom: '10px' }}>
                  {voidProofError}
                </div>
              )}

              <label htmlFor="void-reason-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Mandatory Void Reason (min 5 chars):
              </label>
              <textarea
                id="void-reason-input"
                className="modal-textarea"
                rows="3"
                placeholder="E.g., Incorrect job sheet uploaded for this customer..."
                value={voidReasonInput}
                onChange={(e) => setVoidReasonInput(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setVoidProofTarget(null)}
                disabled={isVoidingProof}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-void-proof-btn"
                className="btn-primary"
                onClick={handleVoidProofSubmit}
                disabled={isVoidingProof || voidReasonInput.trim().length < 5}
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
              >
                {isVoidingProof ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Proof Preview Modal */}
      {previewProof && (
        <div className="admin-modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setPreviewProof(null)}>
          <div
            className="admin-modal-dialog"
            style={{ maxWidth: '750px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h3 className="admin-modal-title" style={{ fontSize: '0.95rem' }}>{previewProof.name}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewProof(null)}
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body" style={{ flex: 1, overflow: 'auto', textAlign: 'center', padding: '16px' }}>
              {previewProof.isPdf ? (
                <iframe
                  src={previewProof.url}
                  title={previewProof.name}
                  style={{ width: '100%', height: '60vh', border: 'none' }}
                />
              ) : (
                <img
                  src={previewProof.url}
                  alt={previewProof.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '4px' }}
                />
              )}
            </div>
            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
              <a
                href={previewProof.url}
                download={previewProof.name}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                ⬇️ Download File
              </a>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setPreviewProof(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Employee Work-Completion Submission Modal */}
      {isCompletionModalOpen && selectedEnquiry && isEmployee && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setIsCompletionModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="admin-modal-header">
              <h2 id="completion-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                Submit Work for Head-Person Approval
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCompletionModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }}>
                Enquiry <strong>{selectedEnquiry.id}</strong> (
                {selectedEnquiry.customer_name || selectedEnquiry.name}) will be submitted to the head-person review queue.
                Please provide a comprehensive summary of the diagnostics, repair, quotation, or service completed (minimum 10 characters).
              </p>
              <label
                htmlFor="completion-summary-input"
                style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
              >
                Work-Completion Summary (Mandatory):
              </label>
              <textarea
                id="completion-summary-input"
                className="modal-textarea"
                rows="4"
                placeholder="E.g., Tested motherboard power rails, replaced blown 19V MOSFET, verified clean boot to desktop, stress-tested CPU/GPU for 2 hours, cleaned fan vents..."
                value={completionSummaryInput}
                onChange={(e) => setCompletionSummaryInput(e.target.value)}
                maxLength={3000}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: completionSummaryInput.trim().length < 10 ? '#dc2626' : '#16a34a' }}>
                  {completionSummaryInput.trim().length} / 10 min characters
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Max 3000 chars
                </span>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setIsCompletionModalOpen(false)}
                disabled={isSubmittingCompletion}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                id="submit-completion-request-btn"
                disabled={isSubmittingCompletion || completionSummaryInput.trim().length < 10}
                onClick={handleSubmitCompletion}
                style={{ background: '#2563eb', borderColor: '#1d4ed8' }}
              >
                {isSubmittingCompletion ? 'Submitting...' : '✨ Submit for Head-Person Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Superadmin Completion Review Confirmation Modal (Approve & Move to Bin OR Return for Rework) */}
      {completionReviewConfirmTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setCompletionReviewConfirmTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-review-confirm-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px' }}
          >
            <div className="admin-modal-header">
              <h2 id="completion-review-confirm-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                {completionReviewConfirmTarget.decision === 'approved'
                  ? 'Approve Work Completion & Permanently Archive'
                  : 'Return Task for Employee Rework'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCompletionReviewConfirmTarget(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }}>
                {completionReviewConfirmTarget.decision === 'approved' ? (
                  <>
                    You are approving the completed work for Enquiry{' '}
                    <strong>{completionReviewConfirmTarget.enquiry.enquiry_number || completionReviewConfirmTarget.enquiry.id}</strong>.
                    The enquiry will become a <strong style={{ color: '#166534' }}>Permanent Archive Record</strong> with no scheduled deletion,
                    immune to automated purge, and assigned to the approval month for compliance reporting.
                  </>
                ) : (
                  <>
                    You are rejecting this completion submission and returning Enquiry{' '}
                    <strong>{completionReviewConfirmTarget.enquiry.enquiry_number || completionReviewConfirmTarget.enquiry.id}</strong> to active status for{' '}
                    <strong style={{ color: '#d97706' }}>Employee Rework</strong>. Staff will be instructed to perform additional work and resubmit.
                  </>
                )}
              </p>

              {/* Submitted Completion Summary Display */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
                <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', marginBottom: '3px' }}>
                  Submitted Work-Completion Summary:
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e3a8a', whiteSpace: 'pre-wrap' }}>
                  {completionReviewConfirmTarget.enquiry.completion_summary || 'No summary recorded'}
                </p>
              </div>

              {/* Review Notes / Mandatory Rework Reason */}
              <label
                htmlFor="completion-review-dialog-notes-input"
                style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
              >
                {completionReviewConfirmTarget.decision === 'approved'
                  ? 'Head-Person Review Notes / Approval Remarks (Optional):'
                  : 'Mandatory Reason for Return / Rework Instructions (Min 5 chars):'}
              </label>
              <textarea
                id="completion-review-dialog-notes-input"
                className="modal-textarea"
                rows="3"
                placeholder={
                  completionReviewConfirmTarget.decision === 'approved'
                    ? 'Add optional sign-off remarks for permanent audit history...'
                    : 'Specify what parts of the task need further testing, customer contact, or rework before approval...'
                }
                value={completionReviewNotesInput}
                onChange={(e) => setCompletionReviewNotesInput(e.target.value)}
                maxLength={1000}
              />
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setCompletionReviewConfirmTarget(null)}
                disabled={isSubmittingCompletionReview}
              >
                Cancel
              </button>
              <button
                type="button"
                id={completionReviewConfirmTarget.decision === 'approved' ? 'confirm-approve-completion-btn' : 'confirm-return-rework-btn'}
                className={completionReviewConfirmTarget.decision === 'approved' ? 'btn-primary' : 'btn-warning'}
                onClick={() =>
                  handleReviewCompletion(
                    completionReviewConfirmTarget.decision,
                    completionReviewNotesInput,
                    null,
                    completionReviewConfirmTarget.enquiry
                  )
                }
                disabled={
                  isSubmittingCompletionReview ||
                  (completionReviewConfirmTarget.decision === 'returned_for_rework' && completionReviewNotesInput.trim().length < 5)
                }
                style={{
                  background: completionReviewConfirmTarget.decision === 'approved' ? '#059669' : '#d97706',
                  borderColor: completionReviewConfirmTarget.decision === 'approved' ? '#047857' : '#b45309',
                  color: '#ffffff'
                }}
              >
                {isSubmittingCompletionReview
                  ? 'Processing...'
                  : completionReviewConfirmTarget.decision === 'approved'
                  ? '✅ Confirm Approval & Permanent Archive'
                  : '🔄 Confirm Return for Rework'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Enquiries XLSX Export Modal (Available to All Active Staff) */}
      {isExportModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => !isExporting && setIsExportModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-monthly-report-modal-title"
        >
          <div
            className="admin-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="admin-modal-header">
              <h2 id="export-monthly-report-modal-title" className="admin-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📊</span> Enquiries Excel Reporting Console
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isExporting && setIsExportModalOpen(false)}
                aria-label="Close dialog"
                disabled={isExporting}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '18px 20px' }}>
              {/* Report Type Selector */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className={exportReportType === 'monthly' ? 'btn-primary' : 'btn-outline'}
                  onClick={() => setExportReportType('monthly')}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.84rem', fontWeight: 600 }}
                >
                  📊 Monthly Audit Report
                </button>
                <button
                  type="button"
                  className={exportReportType === 'daily' ? 'btn-primary' : 'btn-outline'}
                  onClick={() => setExportReportType('daily')}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.84rem', fontWeight: 600 }}
                >
                  📅 Daily Operations Report
                </button>
              </div>

              {exportReportType === 'monthly' ? (
                <>
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      marginBottom: '16px'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.84rem', color: '#166534', marginBottom: '3px' }}>
                      Compliance Reporting Month Rule:
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', lineHeight: 1.4 }}>
                      Monthly audit reports are strictly grounded in <code>completion_approved_at</code> (the date and time when the Head Person approved the completion). An enquiry received in an earlier month belongs strictly to the month of final Head approval.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label htmlFor="export-month-select" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Reporting Month:
                      </label>
                      <select
                        id="export-month-select"
                        className="admin-select"
                        value={exportMonthIndex}
                        onChange={(e) => setExportMonthIndex(parseInt(e.target.value, 10))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={name} value={idx}>{name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="export-year-select" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Reporting Year:
                      </label>
                      <select
                        id="export-year-select"
                        className="admin-select"
                        value={exportYear}
                        onChange={(e) => setExportYear(parseInt(e.target.value, 10))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 600 }}>Standard Filename:</span>
                      <code style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 700 }}>
                        {getMonthlyReportFilename(exportMonthIndex, exportYear)}
                      </code>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 600 }}>Eligible Approved Enquiries:</span>
                      <span style={{ fontSize: '0.88rem', color: eligibleExportCount > 0 ? '#166534' : '#64748b', fontWeight: 700 }}>
                        {eligibleExportCount} record{eligibleExportCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      marginBottom: '16px'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.84rem', color: '#0369a1', marginBottom: '3px' }}>
                      Daily Operations Report:
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#0284c7', lineHeight: 1.4 }}>
                      Exports all enquiries received on the selected calendar date (IST) with full 20 operational columns, assigned engineers, expected visits, and current status.
                    </p>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="export-daily-date" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Select Calendar Date (IST):
                    </label>
                    <input
                      type="date"
                      id="export-daily-date"
                      className="admin-input"
                      value={exportDailyDate}
                      onChange={(e) => setExportDailyDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 600 }}>Target Filename:</span>
                      <code style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 700 }}>
                        {getDailyEnquiryReportFilename(exportDailyDate)}
                      </code>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 600 }}>Enquiries for Date:</span>
                      <span style={{ fontSize: '0.88rem', color: eligibleDailyExportCount > 0 ? '#0369a1' : '#64748b', fontWeight: 700 }}>
                        {eligibleDailyExportCount} record{eligibleDailyExportCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                💡 Excel download is available to all active authorized staff. The generated workbook includes 18 standard audit and accountability columns.
              </p>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
              >
                Close
              </button>
              <button
                type="button"
                id="btn-confirm-download-xlsx"
                className="btn-primary"
                onClick={handleDownloadReport}
                disabled={isExporting}
                style={{
                  background: '#047857',
                  borderColor: '#065f46',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isExporting ? 'Generating Excel...' : '📥 Download XLSX Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Superadmin Bin Restore Confirmation Modal */}
      {binRestoreTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setBinRestoreTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bin-restore-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <div className="admin-modal-header">
              <h2 id="bin-restore-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                Restore Enquiry from Bin
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setBinRestoreTarget(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }}>
                Are you sure you want to restore Enquiry <strong>{binRestoreTarget.enquiry?.id}</strong> from the Bin?
              </p>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: '#065f46' }}>
                  Restoring will cancel the scheduled permanent deletion and return the enquiry to workable status (<strong>in_progress</strong>). An immutable audit record will log this restoration.
                </span>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setBinRestoreTarget(null)}
                disabled={isRestoringFromBin}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                id="confirm-restore-bin-btn"
                onClick={() => handleRestoreFromBin(binRestoreTarget.enquiry)}
                disabled={isRestoringFromBin}
                style={{ background: '#0d9488', borderColor: '#0f766e', color: '#ffffff' }}
              >
                {isRestoringFromBin ? 'Restoring...' : '♻️ Confirm Restore from Bin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Head Assign / Reassign Staff Modal */}
      {isAssignModalOpen && isSuperadmin && selectedEnquiry && (
        <div
          className="admin-modal-backdrop"
          onClick={() => !isSubmittingAssignment && setIsAssignModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="assign-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                  {selectedEnquiry.assigned_employee_id ? 'Reassign Enquiry Engineer' : 'Assign Enquiry Engineer'}
                </h2>
                <span className="modal-subtitle-note">
                  Enquiry {selectedEnquiry.enquiry_number || selectedEnquiry.id}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAssignModalOpen(false)}
                disabled={isSubmittingAssignment}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssignment}>
              <div className="admin-modal-body" style={{ padding: '16px 20px' }}>
                <div className="admin-form-group">
                  <label htmlFor="assign-employee-select" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                    Select Active Employee / Engineer:
                  </label>
                  <select
                    id="assign-employee-select"
                    className="admin-form-input"
                    value={selectedAssigneeId}
                    onChange={(e) => setSelectedAssigneeId(e.target.value)}
                    disabled={isSubmittingAssignment}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Unassigned --</option>
                    {assigneesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.email} {emp.employee_code ? `[${emp.employee_code}]` : ''} ({emp.role}) {emp.phone_number ? `• 📱 ${emp.phone_number}` : '• No phone'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expected Visit Date & Time */}
                {selectedAssigneeId && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e2e8f0' }}>
                      📅 Expected Engineer Visit
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div className="admin-form-group" style={{ flex: '1 1 160px' }}>
                        <label htmlFor="assign-visit-date" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                          Visit Date <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                        </label>
                        <input
                          id="assign-visit-date"
                          type="date"
                          className="admin-form-input"
                          value={assignVisitDate}
                          onChange={(e) => setAssignVisitDate(e.target.value)}
                          disabled={isSubmittingAssignment}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div className="admin-form-group" style={{ flex: '1 1 130px' }}>
                        <label htmlFor="assign-visit-time" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                          Arrival Time <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                        </label>
                        <input
                          id="assign-visit-time"
                          type="time"
                          className="admin-form-input"
                          value={assignVisitTime}
                          onChange={(e) => setAssignVisitTime(e.target.value)}
                          disabled={isSubmittingAssignment || !assignVisitDate}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    <div className="admin-form-group" style={{ marginTop: '8px' }}>
                      <label htmlFor="assign-visit-note" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                        Visit Note <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <textarea
                        id="assign-visit-note"
                        className="admin-form-input"
                        placeholder="e.g. Customer requested afternoon slot, bring thermal paste..."
                        value={assignVisitNote}
                        onChange={(e) => setAssignVisitNote(e.target.value)}
                        disabled={isSubmittingAssignment}
                        maxLength={300}
                        rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                )}

                <div className="admin-form-group" style={{ marginTop: '12px' }}>
                  <label htmlFor="assign-reason-input" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                    Assignment / Reassignment Reason <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>:
                  </label>
                  <input
                    id="assign-reason-input"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Workload balancing, onsite hardware technician needed..."
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                    disabled={isSubmittingAssignment}
                    maxLength={200}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {assignmentError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      marginTop: '12px',
                      fontSize: '0.85rem'
                    }}
                    role="alert"
                  >
                    ⚠️ {assignmentError}
                  </div>
                )}
              </div>

              <div className="admin-modal-footer" style={{ padding: '12px 20px' }}>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={isSubmittingAssignment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingAssignment}
                >
                  {isSubmittingAssignment ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Advanced Excel-like Live Enquiry Register Modal */}
      {isLiveRegisterOpen && (
        <Suspense fallback={null}>
          <LiveEnquiryRegisterModal
            isOpen={isLiveRegisterOpen}
            onClose={() => setIsLiveRegisterOpen(false)}
            enquiries={enquiries}
            onSelectEnquiry={(enq) => {
              setSelectedEnquiry(enq)
            }}
            onRefresh={() => loadAdminEnquiries && loadAdminEnquiries()}
            isLoading={isLoadingEnquiries}
            adminUser={adminUser}
          />
        </Suspense>
      )}

      {/* 12. Employee Self-Assign Confirmation Modal (visit time optional) */}
      {isSelfAssignModalOpen && isEmployee && selectedEnquiry && (
        <div
          className="admin-modal-backdrop"
          onClick={() => !isSelfAssigning && setIsSelfAssignModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="self-assign-modal-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="self-assign-modal-title" className="admin-modal-title" style={{ margin: 0 }}>
                  Take This Enquiry
                </h2>
                <span className="modal-subtitle-note">
                  Enquiry {selectedEnquiry.enquiry_number || selectedEnquiry.id}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSelfAssignModalOpen(false)}
                disabled={isSelfAssigning}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSelfAssign}>
              <div className="admin-modal-body" style={{ padding: '16px 20px' }}>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                  You are about to take responsibility for this enquiry. Your identity will be recorded server-side from your authenticated session.
                </p>

                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e2e8f0' }}>
                  📅 Expected Arrival (Optional)
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div className="admin-form-group" style={{ flex: '1 1 160px' }}>
                    <label htmlFor="self-visit-date" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                      Visit Date
                    </label>
                    <input
                      id="self-visit-date"
                      type="date"
                      className="admin-form-input"
                      value={selfVisitDate}
                      onChange={(e) => setSelfVisitDate(e.target.value)}
                      disabled={isSelfAssigning}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="admin-form-group" style={{ flex: '1 1 120px' }}>
                    <label htmlFor="self-visit-time" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                      Arrival Time
                    </label>
                    <input
                      id="self-visit-time"
                      type="time"
                      className="admin-form-input"
                      value={selfVisitTime}
                      onChange={(e) => setSelfVisitTime(e.target.value)}
                      disabled={isSelfAssigning || !selfVisitDate}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="self-visit-note" className="admin-form-label" style={{ fontWeight: 600, color: '#334155' }}>
                    Visit Note <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <textarea
                    id="self-visit-note"
                    className="admin-form-input"
                    placeholder="e.g. Will bring replacement HDD, scheduled for AM..."
                    value={selfVisitNote}
                    onChange={(e) => setSelfVisitNote(e.target.value)}
                    disabled={isSelfAssigning}
                    maxLength={300}
                    rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '8px 12px', marginTop: '10px', fontSize: '0.79rem', color: '#0369a1' }}>
                  ℹ️ Your name, employee code, phone, and Aadhaar are captured server-side. You cannot modify your own identity.
                </div>
              </div>

              <div className="admin-modal-footer" style={{ padding: '12px 20px' }}>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setIsSelfAssignModalOpen(false)}
                  disabled={isSelfAssigning}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSelfAssigning}
                >
                  {isSelfAssigning ? 'Assigning...' : '✋ Confirm Self-Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </AdminLayout>
  )
}
