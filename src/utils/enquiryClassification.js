/**
 * ============================================================================
 * ARS Computers — Pure Enquiry Classification & IST Date Helper
 * ============================================================================
 * Centralized, shared pure functions for categorizing enquiries into disjoint,
 * mutually exclusive workflow buckets, computing follow-up urgency,
 * formatting IST calendar dates, and aggregating employee workload.
 *
 * Used across:
 * - AdminDataProvider (memoized metrics computation)
 * - AdminDashboardPage (metric cards & workload presentation)
 * - AdminEnquiriesPage (URL filter binding & table filtering)
 * - Automated test suites
 * ============================================================================
 */

/**
 * Returns the calendar date formatted as YYYY-MM-DD in the business's local
 * timezone (Asia/Kolkata, UTC+5:30).
 * Safely handles strings, numbers, Date objects, null, undefined, and invalid dates.
 *
 * @param {string|number|Date} dateInput
 * @returns {string|null} YYYY-MM-DD or null if invalid
 */
export function getISTCalendarDate(dateInput) {
  if (dateInput === null || dateInput === undefined || dateInput === '') return null
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d)
  } catch {
    return null
  }
}

/**
 * Safely parses a reference date or timestamp into a valid Date object.
 * Falls back to current time if invalid.
 *
 * @param {string|number|Date} [referenceDate]
 * @returns {Date}
 */
export function safeDate(referenceDate) {
  if (!referenceDate) return new Date()
  try {
    const d = typeof referenceDate === 'string' || typeof referenceDate === 'number'
      ? new Date(referenceDate)
      : referenceDate
    if (d instanceof Date && !isNaN(d.getTime())) return d
    return new Date()
  } catch {
    return new Date()
  }
}

/**
 * Classifies an enquiry row into mutually exclusive workflow buckets and
 * calculates all derived flags (completed, in progress, pending, unassigned,
 * overdue follow-up, today).
 *
 * Priority order ensures mutual exclusivity:
 * 1. isRemoved / isInBin -> isolated/excluded from active operations
 * 2. isCompleted (status === 'completed' OR completion_approved_at !== null) -> locked to Completed
 * 3. isInProgress (status === 'in_progress' AND !is_archived) -> locked to In Progress
 * 4. isPending (status IN ('new', 'quoted', 'completion_requested', 'returned_for_rework', 'rejection_requested') AND !is_archived)
 *
 * @param {object} e - Enquiry row
 * @param {string|number|Date} [referenceDate] - Current reference time (defaults to now)
 * @returns {object} Classification flags and workflow bucket
 */
export function classifyEnquiry(e, referenceDate = new Date()) {
  const ref = safeDate(referenceDate)

  if (!e || typeof e !== 'object') {
    return {
      isLegitimate: false,
      isRemoved: false,
      isInBin: false,
      isArchived: false,
      isCompleted: false,
      isInProgress: false,
      isPending: false,
      isUnassigned: false,
      isOverdue: false,
      isToday: false,
      workflowBucket: 'unknown'
    }
  }

  const isRemoved = Boolean(e.is_removed)
  const isInBin = Boolean(e.is_in_bin || e.status === 'in_bin')
  const isArchived = Boolean(e.is_archived)

  // 1. COMPLETED: Evaluated FIRST so approval lock always takes precedence.
  // Any record where completion_approved_at is populated is locked to Completed,
  // preventing it from ever being counted in Pending or In Progress.
  const isCompleted = !isRemoved && !isInBin && (
    e.status === 'completed' ||
    (e.completion_approved_at !== null && e.completion_approved_at !== undefined)
  )

  // 2. IN PROGRESS: Mutually exclusive from Completed.
  const isInProgress = !isRemoved && !isInBin && !isCompleted && !isArchived && (
    e.status === 'in_progress'
  )

  // 3. PENDING: Mutually exclusive from Completed and In Progress.
  const isPending = !isRemoved && !isInBin && !isCompleted && !isInProgress && !isArchived && (
    ['new', 'quoted', 'completion_requested', 'returned_for_rework', 'rejection_requested'].includes(e.status)
  )

  // 4. UNASSIGNED: Active open queue requiring engineering dispatch.
  const isUnassigned = !isRemoved && !isInBin && !isCompleted && !isArchived &&
    !['rejected', 'closed'].includes(e.status) &&
    (e.assigned_employee_id === null || e.assigned_employee_id === undefined || e.assigned_employee_id === '')

  // 5. OVERDUE: Scheduled follow-up/visit date strictly in the past, not completed or cancelled.
  let isOverdue = false
  if (
    !isRemoved && !isInBin && !isCompleted && !isArchived &&
    !['rejected', 'closed'].includes(e.status) &&
    e.expected_visit_at
  ) {
    const visitTime = new Date(e.expected_visit_at).getTime()
    const nowTime = ref.getTime()
    if (!isNaN(visitTime) && visitTime < nowTime && !['completed', 'cancelled'].includes(e.visit_status)) {
      isOverdue = true
    }
  }

  // 6. TODAY: Created on today's calendar day in Asia/Kolkata (includes jobs completed today).
  const isToday = !isRemoved && !isInBin && (
    getISTCalendarDate(e.created_at) === getISTCalendarDate(ref)
  )

  let workflowBucket = 'other'
  if (isRemoved) workflowBucket = 'removed'
  else if (isInBin) workflowBucket = 'bin'
  else if (isCompleted) workflowBucket = 'completed'
  else if (isInProgress) workflowBucket = 'in_progress'
  else if (isPending) workflowBucket = 'pending'
  else if (['rejected', 'closed'].includes(e.status)) workflowBucket = 'closed'

  return {
    isLegitimate: !isRemoved && !isInBin,
    isRemoved,
    isInBin,
    isArchived,
    isCompleted,
    isInProgress,
    isPending,
    isUnassigned,
    isOverdue,
    isToday,
    workflowBucket
  }
}

/**
 * Roles considered operational service / engineering staff who handle customer
 * tickets and should appear by default in the Head's Employee Workload Table.
 */
export const OPERATIONAL_WORKLOAD_ROLES = ['engineer', 'technical', 'admin']

/**
 * Computes workload statistics for a given staff member across a list of enquiries.
 *
 * @param {string} staffId - UUID or employee ID
 * @param {Array} enquiries - List of enquiry records
 * @returns {object} Workload breakdown (activeAssigned, awaitingApproval, completed, overdueCount)
 */
export function computeStaffWorkload(staffId, enquiries = []) {
  if (!staffId || !Array.isArray(enquiries)) {
    return { activeAssigned: 0, awaitingApproval: 0, completed: 0, overdueCount: 0 }
  }

  let activeAssigned = 0
  let awaitingApproval = 0
  let completed = 0
  let overdueCount = 0

  for (const enq of enquiries) {
    if (enq.assigned_employee_id !== staffId) continue
    const c = classifyEnquiry(enq)
    if (!c.isLegitimate) continue

    if (c.isCompleted) {
      completed += 1
    } else if (!c.isArchived) {
      if (['new', 'in_progress', 'quoted', 'returned_for_rework', 'completion_requested'].includes(enq.status)) {
        activeAssigned += 1
        // Note: awaitingApproval is strictly a SUBSET of activeAssigned, never added to it
        if (enq.status === 'completion_requested') {
          awaitingApproval += 1
        }
      }
      if (c.isOverdue) {
        overdueCount += 1
      }
    }
  }

  return {
    activeAssigned,
    awaitingApproval,
    completed,
    overdueCount
  }
}
