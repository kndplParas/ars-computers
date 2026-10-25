import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AdminDataContext } from './adminDataContext'
import { useAdminAuth } from './adminAuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { fetchAdminCategories, fetchAdminProducts, invalidateCatalogCache } from '../lib/catalog'
import { INITIAL_DEMO_PRODUCTS } from '../data/mockProducts'
import { CATEGORIES as INITIAL_CATEGORIES } from '../data/categories'
import { INITIAL_DEMO_ENQUIRIES } from '../data/mockEnquiries'
import { INITIAL_DEMO_STAFF } from '../data/mockStaff'
import { INITIAL_DEMO_SERVICE_REQUESTS } from '../data/mockServiceRequests'

const STORAGE_KEYS = {
  PRODUCTS: 'ars_admin_demo_products_v1',
  CATEGORIES: 'ars_admin_demo_categories_v1',
  ENQUIRIES: 'ars_admin_demo_enquiries_v1',
  STAFF: 'ars_admin_demo_staff_v1',
  SERVICE_REQUESTS: 'ars_admin_demo_service_requests_v1'
}

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback
  } catch (err) {
    console.warn(`[AdminDataProvider] Error loading key "${key}" from localStorage, falling back to initial data:`, err)
    return fallback
  }
}

export function AdminDataProvider({ children }) {
  const { adminUser, isAuthenticated } = useAdminAuth()

  // Determine whether to use Live Supabase database or Local Demo State
  const isLiveDatabase = Boolean(isSupabaseConfigured && isAuthenticated && adminUser)
  const dataSource = isLiveDatabase ? 'database' : 'demo'

  // --- Local Demo State (Persisted in LocalStorage for offline/demo evaluation only) ---
  const [demoProducts, setDemoProducts] = useState(() =>
    safeLoad(STORAGE_KEYS.PRODUCTS, INITIAL_DEMO_PRODUCTS)
  )

  const [demoCategories, setDemoCategories] = useState(() => {
    const fallbackCategories = INITIAL_CATEGORIES.map((c) => ({
      ...c,
      is_active: c.is_active ?? true
    }))
    return safeLoad(STORAGE_KEYS.CATEGORIES, fallbackCategories)
  })

  const [demoEnquiries, setDemoEnquiries] = useState(() =>
    safeLoad(STORAGE_KEYS.ENQUIRIES, INITIAL_DEMO_ENQUIRIES)
  )

  const [demoStaff, setDemoStaff] = useState(() =>
    safeLoad(STORAGE_KEYS.STAFF, INITIAL_DEMO_STAFF)
  )

  const [demoServiceRequests, setDemoServiceRequests] = useState(() =>
    safeLoad(STORAGE_KEYS.SERVICE_REQUESTS, INITIAL_DEMO_SERVICE_REQUESTS)
  )

  // Sync demo state to LocalStorage ONLY when offline/demo; live records never touch localStorage
  useEffect(() => {
    if (!isLiveDatabase) {
      try {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(demoProducts))
      } catch (e) {
        console.warn('[AdminDataProvider] Failed to save demo products to localStorage:', e)
      }
    }
  }, [demoProducts, isLiveDatabase])

  useEffect(() => {
    if (!isLiveDatabase) {
      try {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(demoCategories))
      } catch (e) {
        console.warn('[AdminDataProvider] Failed to save demo categories to localStorage:', e)
      }
    }
  }, [demoCategories, isLiveDatabase])

  useEffect(() => {
    if (!isLiveDatabase) {
      try {
        localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(demoEnquiries))
      } catch (e) {
        console.warn('[AdminDataProvider] Failed to save enquiries to localStorage:', e)
      }
    }
  }, [demoEnquiries, isLiveDatabase])

  useEffect(() => {
    if (!isLiveDatabase) {
      try {
        localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(demoStaff))
      } catch (e) {
        console.warn('[AdminDataProvider] Failed to save staff to localStorage:', e)
      }
    }
  }, [demoStaff, isLiveDatabase])

  useEffect(() => {
    if (!isLiveDatabase) {
      try {
        localStorage.setItem(STORAGE_KEYS.SERVICE_REQUESTS, JSON.stringify(demoServiceRequests))
      } catch (e) {
        console.warn('[AdminDataProvider] Failed to save service requests to localStorage:', e)
      }
    }
  }, [demoServiceRequests, isLiveDatabase])

  // --- Live Supabase Database State ---
  const [liveProducts, setLiveProducts] = useState([])
  const [liveCategories, setLiveCategories] = useState([])
  const [liveEnquiries, setLiveEnquiries] = useState([])
  const [liveStaff, setLiveStaff] = useState([])
  const [liveServiceRequests, setLiveServiceRequests] = useState([])

  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isLoadingEnquiries, setIsLoadingEnquiries] = useState(false)
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const [isLoadingServiceRequests, setIsLoadingServiceRequests] = useState(false)

  const [databaseError, setDatabaseError] = useState(null)
  const [enquiriesError, setEnquiriesError] = useState(null)
  const [staffError, setStaffError] = useState(null)
  const [serviceRequestsError, setServiceRequestsError] = useState(null)
  const [isPermissionDenied, setIsPermissionDenied] = useState(false)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    hasMore: false,
    totalLoaded: 0
  })

  // --- Fetch Categories from Database ---
  const loadAdminCategories = useCallback(async () => {
    if (!isLiveDatabase) return

    setIsLoadingCategories(true)
    try {
      const result = await fetchAdminCategories()
      if (result.error) {
        setLiveCategories([])
        setDatabaseError(result.error)
      } else {
        const mapped = (result.categories || []).map((c) => ({
          ...c,
          name: c.title,
          dbId: c.id
        }))
        setLiveCategories(mapped)
      }
    } catch (err) {
      setLiveCategories([])
      setDatabaseError(err.message || 'Failed to query categories.')
    } finally {
      setIsLoadingCategories(false)
    }
  }, [isLiveDatabase])

  // Ref to allow loadAdminProducts to read latest categories without recreating callback
  const liveCategoriesRef = useRef(liveCategories)
  useEffect(() => {
    liveCategoriesRef.current = liveCategories
  }, [liveCategories])

  // --- Fetch Admin Products via get_admin_products RPC ---
  const loadAdminProducts = useCallback(
    async ({ categoryId = null, page = 1, limit = 50 } = {}) => {
      if (!isLiveDatabase) return

      setIsLoadingProducts(true)
      const offset = Math.max((Number(page) - 1) * Number(limit), 0)

      try {
        const result = await fetchAdminProducts({
          categoryId,
          includeInactive: true,
          limit,
          offset,
          categories: liveCategoriesRef.current
        })

        if (result.error) {
          // STRICT RULE: Never silently fallback to demo data on live database failure
          setLiveProducts([])
          setDatabaseError(result.error)
          setIsPermissionDenied(Boolean(result.isPermissionDenied))
          setPagination({
            page,
            limit,
            hasMore: false,
            totalLoaded: 0
          })
        } else {
          setLiveProducts(result.products || [])
          setDatabaseError(null)
          setIsPermissionDenied(false)
          setPagination({
            page,
            limit,
            hasMore: (result.products || []).length === limit,
            totalLoaded: (result.products || []).length
          })
        }
      } catch (err) {
        // STRICT RULE: Never silently fallback to demo data on live database failure
        setLiveProducts([])
        setDatabaseError(err.message || 'Failed to query admin product catalog.')
        setIsPermissionDenied(false)
      } finally {
        setIsLoadingProducts(false)
      }
    },
    [isLiveDatabase]
  )

  // --- Fetch Admin Enquiries from Supabase public.enquiries ---
  const loadAdminEnquiries = useCallback(async () => {
    if (!isLiveDatabase) return

    // Strict confidentiality & authorization: Only superadmin and admin can view enquiries
    const role = adminUser?.role
    if (role !== 'superadmin' && role !== 'admin') {
      setLiveEnquiries([])
      setEnquiriesError(null)
      return
    }

    setIsLoadingEnquiries(true)
    setEnquiriesError(null)

    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured.')
      }

      const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        // STRICT RULE: Never silently fallback to demo data on live database failure
        setLiveEnquiries([])
        setEnquiriesError(error.message || 'Failed to query customer enquiries.')
      } else {
        const mapped = (data || []).map((row) => ({
          ...row,
          customer_name: row.name,
          category_label: row.category_interest || 'General Hardware',
          is_archived: Boolean(row.is_archived),
          is_in_bin: Boolean(row.is_in_bin)
        }))
        setLiveEnquiries(mapped)
        setEnquiriesError(null)
      }
    } catch (err) {
      // STRICT RULE: Never silently fallback to demo data on live database failure
      setLiveEnquiries([])
      setEnquiriesError(err.message || 'Failed to query customer enquiries.')
    } finally {
      setIsLoadingEnquiries(false)
    }
  }, [isLiveDatabase, adminUser])

  // --- Fetch Staff Directory from Database (Superadmin Only) ---
  const loadAdminStaff = useCallback(async () => {
    if (!isLiveDatabase) return

    // Strict Authorization check: only superadmins can query staff directory
    if (adminUser?.role !== 'superadmin') {
      setLiveStaff([])
      setStaffError('Access restricted: Store Superadministrator privileges required.')
      return
    }

    setIsLoadingStaff(true)
    setStaffError(null)

    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured.')
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('id, email, full_name, role, is_active, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (error) {
        // Fail closed: never fall back to demo data on live database failure
        setLiveStaff([])
        setStaffError(error.message || 'Failed to query staff directory.')
      } else {
        setLiveStaff(data || [])
        setStaffError(null)
      }
    } catch (err) {
      setLiveStaff([])
      setStaffError(err.message || 'Failed to query staff directory.')
    } finally {
      setIsLoadingStaff(false)
    }
  }, [isLiveDatabase, adminUser])

  // --- Fetch Service Requests from Database (Staff Members) ---
  const loadAdminServiceRequests = useCallback(async () => {
    if (!isLiveDatabase) return

    const role = adminUser?.role
    if (role !== 'superadmin' && role !== 'admin' && role !== 'inventory_staff') {
      setLiveServiceRequests([])
      setServiceRequestsError(null)
      return
    }

    setIsLoadingServiceRequests(true)
    setServiceRequestsError(null)

    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured.')
      }

      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setLiveServiceRequests([])
        setServiceRequestsError(error.message || 'Failed to query service requests.')
      } else {
        setLiveServiceRequests(data || [])
        setServiceRequestsError(null)
      }
    } catch (err) {
      setLiveServiceRequests([])
      setServiceRequestsError(err.message || 'Failed to query service requests.')
    } finally {
      setIsLoadingServiceRequests(false)
    }
  }, [isLiveDatabase, adminUser])

  // Load database catalog on mount or when auth state transitions to authenticated
  useEffect(() => {
    let ignore = false

    const init = async () => {
      // Yield to microtask queue to avoid synchronous cascading renders during effect mount
      await Promise.resolve()
      if (ignore) return

      if (isLiveDatabase) {
        loadAdminCategories()
        loadAdminProducts({ page: 1, limit: 50 })
        if (adminUser?.role === 'superadmin' || adminUser?.role === 'admin') {
          loadAdminEnquiries()
        } else {
          setLiveEnquiries([])
        }
        if (adminUser?.role === 'superadmin') {
          loadAdminStaff()
        } else {
          setLiveStaff([])
        }
        if (adminUser?.role === 'superadmin' || adminUser?.role === 'admin' || adminUser?.role === 'inventory_staff') {
          loadAdminServiceRequests()
        } else {
          setLiveServiceRequests([])
        }
      } else {
        setLiveCategories([])
        setLiveProducts([])
        setLiveEnquiries([])
        setLiveStaff([])
        setLiveServiceRequests([])
        setDatabaseError(null)
        setEnquiriesError(null)
        setStaffError(null)
        setServiceRequestsError(null)
        setIsPermissionDenied(false)
      }
    }

    init()

    return () => {
      ignore = true
    }
  }, [isLiveDatabase, adminUser, loadAdminCategories, loadAdminProducts, loadAdminEnquiries, loadAdminStaff, loadAdminServiceRequests])

  // Active displayed datasets (STRICT: If live is active, use live records or empty on error)
  const products = isLiveDatabase ? liveProducts : demoProducts
  const categories = isLiveDatabase ? liveCategories : demoCategories
  const enquiries = isLiveDatabase ? liveEnquiries : demoEnquiries
  const staff = isLiveDatabase ? liveStaff : demoStaff
  const serviceRequests = isLiveDatabase ? liveServiceRequests : demoServiceRequests

  // --- Category Lookup Helper (Resolves both UUID and Slug) ---
  const findCategory = useCallback(
    (idOrSlug) => {
      if (!idOrSlug) return null
      const list = isLiveDatabase ? liveCategories : demoCategories
      return list.find((c) => c.id === idOrSlug || c.slug === idOrSlug) || null
    },
    [isLiveDatabase, liveCategories, demoCategories]
  )

  // --- Product Mutators (Live Supabase Mutations for Superadmin) ---
  const addProduct = useCallback(
    async (newProduct) => {
      // Database INSERT mutation is disabled for non-superadmins (fails closed)
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to create products.')
      }
      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')
        const { data, error } = await supabase
          .from('products')
          .insert([newProduct])
          .select()

        if (error) throw error

        invalidateCatalogCache()
        await loadAdminProducts()
        return data?.[0]
      }
      setDemoProducts((prev) => [newProduct, ...prev])
    },
    [isLiveDatabase, adminUser, loadAdminProducts]
  )

  const updateProduct = useCallback(
    async (id, updates) => {
      // Database UPDATE mutation is disabled for non-superadmins (fails closed)
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to edit products.')
      }
      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')
        const { data, error } = await supabase
          .from('products')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()

        if (error) throw error

        invalidateCatalogCache()
        await loadAdminProducts()
        return data?.[0]
      }
      setDemoProducts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      )
    },
    [isLiveDatabase, adminUser, loadAdminProducts]
  )

  // Dedicated stock adjustment mutator for inventory staff and superadmin
  const updateProductStock = useCallback(
    async (productId, { stock_quantity, min_stock_alert, availability_status }) => {
      if (adminUser?.role !== 'superadmin' && adminUser?.role !== 'inventory_staff') {
        throw new Error('Access denied: Stock modifications require superadmin or inventory staff role.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { error } = await supabase
          .from('products')
          .update({
            stock_quantity,
            min_stock_alert,
            availability_status
          })
          .eq('id', productId)

        if (error) throw error

        invalidateCatalogCache()
        await loadAdminProducts()
        return
      }

      setDemoProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, stock_quantity, min_stock_alert, availability_status }
            : p
        )
      )
    },
    [isLiveDatabase, adminUser, loadAdminProducts]
  )

  // Soft Delete RPC invocation
  const softDeleteProduct = useCallback(
    async (productId) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to deactivate products.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { error } = await supabase.rpc('soft_delete_product', {
          p_product_id: productId
        })

        if (error) {
          throw error
        }

        invalidateCatalogCache()
        setLiveProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, is_active: false } : p))
        )
        return
      }

      setDemoProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: false } : p))
      )
    },
    [isLiveDatabase, adminUser]
  )

  // Reactivate product via update
  const reactivateProduct = useCallback(
    async (productId) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to reactivate products.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { error } = await supabase
          .from('products')
          .update({
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', productId)

        if (error) {
          throw error
        }

        invalidateCatalogCache()
        setLiveProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, is_active: true } : p))
        )
        return
      }

      setDemoProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: true } : p))
      )
    },
    [isLiveDatabase, adminUser]
  )

  // Hard Delete (Superadmin only)
  const hardDeleteProduct = useCallback(
    async (productId) => {
      if (isLiveDatabase) {
        if (adminUser?.role !== 'superadmin') {
          throw new Error('Access denied: Hard product deletion is strictly restricted to superadministrators.')
        }
        if (!supabase) throw new Error('Supabase client is not available.')

        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId)

        if (error) {
          throw error
        }

        invalidateCatalogCache()
        setLiveProducts((prev) => prev.filter((p) => p.id !== productId))
        return
      }

      setDemoProducts((prev) => prev.filter((p) => p.id !== productId))
    },
    [isLiveDatabase, adminUser]
  )

  const toggleProductActive = useCallback(
    async (id) => {
      if (isLiveDatabase) {
        const prod = liveProducts.find((p) => p.id === id)
        if (prod && prod.is_active) {
          return softDeleteProduct(id)
        } else if (prod) {
          return reactivateProduct(id)
        }
        return
      }
      setDemoProducts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_active: !item.is_active } : item))
      )
    },
    [isLiveDatabase, liveProducts, softDeleteProduct, reactivateProduct]
  )

  // --- Category Mutators (Superadmin Only) ---
  const addCategory = useCallback(
    async (newCategory) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to create categories.')
      }
      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')
        const { error } = await supabase.from('categories').insert([newCategory])
        if (error) throw error
        invalidateCatalogCache()
        await loadAdminCategories()
        return
      }
      setDemoCategories((prev) => [newCategory, ...prev])
    },
    [isLiveDatabase, adminUser, loadAdminCategories]
  )

  const updateCategory = useCallback(
    async (id, updates) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to edit categories.')
      }
      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')
        const { error } = await supabase.from('categories').update(updates).eq('id', id)
        if (error) throw error
        invalidateCatalogCache()
        await loadAdminCategories()
        return
      }
      setDemoCategories((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      )
    },
    [isLiveDatabase, adminUser, loadAdminCategories]
  )

  const toggleCategoryActive = useCallback(
    async (id) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to modify category active status.')
      }
      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')
        const target = liveCategories.find((c) => c.id === id)
        if (!target) return
        const { error } = await supabase
          .from('categories')
          .update({ is_active: !target.is_active })
          .eq('id', id)
        if (error) throw error
        invalidateCatalogCache()
        await loadAdminCategories()
        return
      }
      setDemoCategories((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_active: !item.is_active } : item))
      )
    },
    [isLiveDatabase, adminUser, liveCategories, loadAdminCategories]
  )

  // --- Phase 2: Enquiry Workflow Mutators & Approval RPCs ---

  // 1. Add Timestamped Follow-up Note (Admin & Superadmin)
  const addEnquiryNote = useCallback(
    async (enquiryId, content) => {
      if (adminUser?.role !== 'superadmin' && adminUser?.role !== 'admin') {
        throw new Error('Access denied: Administrator privileges required to add enquiry notes.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('add_enquiry_note', {
          p_enquiry_id: enquiryId,
          p_content: content
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      // Demo fallback
      setDemoEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiryId
            ? { ...e, admin_notes: (e.admin_notes ? e.admin_notes + '\n' : '') + content }
            : e
        )
      )
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // 2. Update Operational Progress (Admin & Superadmin, subject to state rules)
  const updateEnquiryProgress = useCallback(
    async (enquiryId, nextStatus) => {
      if (adminUser?.role !== 'superadmin' && adminUser?.role !== 'admin') {
        throw new Error('Access denied: Administrator privileges required to update enquiry progress.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('update_enquiry_progress', {
          p_enquiry_id: enquiryId,
          p_next_status: nextStatus
        })

        if (error) throw error

        setLiveEnquiries((prev) =>
          prev.map((e) => (e.id === enquiryId ? { ...e, status: nextStatus, updated_at: new Date().toISOString() } : e))
        )
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, status: nextStatus } : e))
      )
    },
    [isLiveDatabase, adminUser]
  )

  // 3. Request Rejection with Mandatory Reason (Admin & Superadmin)
  const requestEnquiryRejection = useCallback(
    async (enquiryId, reason) => {
      if (adminUser?.role !== 'superadmin' && adminUser?.role !== 'admin') {
        throw new Error('Access denied: Administrator privileges required to request rejection.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('request_enquiry_rejection', {
          p_enquiry_id: enquiryId,
          p_reason: reason
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiryId
            ? {
                ...e,
                previous_status: e.status,
                status: 'rejection_requested',
                rejection_reason: reason
              }
            : e
        )
      )
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // 4. Review Rejection Request (Superadmin Only: 'approved' | 'denied')
  const reviewEnquiryRejection = useCallback(
    async (enquiryId, decision, reviewNotes = '') => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can review rejection requests.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('review_enquiry_rejection', {
          p_enquiry_id: enquiryId,
          p_decision: decision,
          p_review_notes: reviewNotes || null
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiryId
            ? {
                ...e,
                status: decision === 'approved' ? 'rejected' : e.previous_status || 'in_progress',
                rejection_reason: decision === 'approved' ? e.rejection_reason : null
              }
            : e
        )
      )
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // 5. Archive Enquiry (Superadmin Only)
  const archiveEnquiry = useCallback(
    async (enquiryId) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can archive enquiries.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('archive_enquiry', {
          p_enquiry_id: enquiryId
        })

        if (error) throw error

        setLiveEnquiries((prev) =>
          prev.map((e) =>
            e.id === enquiryId ? { ...e, is_archived: true, archived_at: new Date().toISOString() } : e
          )
        )
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, is_archived: true } : e))
      )
    },
    [isLiveDatabase, adminUser]
  )

  // 6. Restore Enquiry (Superadmin Only)
  const restoreEnquiry = useCallback(
    async (enquiryId) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can restore enquiries.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('restore_enquiry', {
          p_enquiry_id: enquiryId
        })

        if (error) throw error

        setLiveEnquiries((prev) =>
          prev.map((e) =>
            e.id === enquiryId ? { ...e, is_archived: false, archived_at: null, archived_by: null } : e
          )
        )
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, is_archived: false } : e))
      )
    },
    [isLiveDatabase, adminUser]
  )

  // 7. Fetch Activity History for an Enquiry (All Active Admins)
  const fetchEnquiryActivities = useCallback(
    async (enquiryId) => {
      if (isLiveDatabase && supabase) {
        const { data, error } = await supabase
          .from('enquiry_activities')
          .select('id, enquiry_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at')
          .eq('enquiry_id', enquiryId)
          .order('created_at', { ascending: true })

        if (error) throw error
        return data || []
      }
      return []
    },
    [isLiveDatabase]
  )

  // 8. Submit Enquiry Completion (Staff & Superadmin)
  const submitEnquiryCompletion = useCallback(
    async (enquiryId, completionSummary) => {
      const role = adminUser?.role
      if (role !== 'superadmin' && role !== 'admin') {
        throw new Error('Access denied: Administrator privileges required to submit work completion.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('submit_enquiry_completion', {
          p_enquiry_id: enquiryId,
          p_completion_summary: completionSummary
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiryId
            ? {
                ...e,
                previous_status: e.status,
                status: 'completion_requested',
                completion_summary: completionSummary,
                completion_rework_reason: null
              }
            : e
        )
      )
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // 9. Review Enquiry Completion (Superadmin Only: 'approved' | 'returned_for_rework')
  const reviewEnquiryCompletion = useCallback(
    async (enquiryId, decision, reviewNotes = '', retentionDays = 7) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can review completion requests.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('review_enquiry_completion', {
          p_enquiry_id: enquiryId,
          p_decision: decision,
          p_review_notes: reviewNotes || null,
          p_retention_days: retentionDays || 7
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) => {
          if (e.id !== enquiryId) return e
          if (decision === 'approved') {
            const now = new Date()
            const deletionDate = new Date(now.getTime() + (retentionDays || 7) * 24 * 60 * 60 * 1000)
            return {
              ...e,
              status: 'in_bin',
              is_in_bin: true,
              bin_entered_at: now.toISOString(),
              scheduled_deletion_at: deletionDate.toISOString()
            }
          } else {
            return {
              ...e,
              status: 'returned_for_rework',
              completion_rework_reason: reviewNotes
            }
          }
        })
      )
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // 10. Restore Enquiry From Bin (Superadmin Only)
  const restoreEnquiryFromBin = useCallback(
    async (enquiryId) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can restore enquiries from the Bin.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('restore_enquiry_from_bin', {
          p_enquiry_id: enquiryId
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      setDemoEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiryId
            ? {
                ...e,
                status: 'quoted',
                is_in_bin: false,
                bin_entered_at: null,
                scheduled_deletion_at: null
              }
            : e
        )
      )
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // 11. Purge Expired Bin Enquiries (Superadmin Only / Server-side)
  const purgeExpiredBinEnquiries = useCallback(
    async (retentionGraceSeconds = 0) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can trigger Bin purge.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('purge_expired_bin_enquiries', {
          p_retention_grace_seconds: retentionGraceSeconds || 0
        })

        if (error) throw error

        await loadAdminEnquiries()
        return data
      }

      setDemoEnquiries((prev) =>
        prev.filter((e) => {
          if (!e.is_in_bin || !e.scheduled_deletion_at) return true
          return new Date(e.scheduled_deletion_at) > new Date()
        })
      )
      return { success: true, message: 'Purged in demo mode' }
    },
    [isLiveDatabase, adminUser, loadAdminEnquiries]
  )

  // Backwards compatibility wrappers
  const updateEnquiryStatus = useCallback(
    async (id, newStatus) => {
      return updateEnquiryProgress(id, newStatus)
    },
    [updateEnquiryProgress]
  )

  const updateEnquiryNotes = useCallback(
    async (id, notes) => {
      return addEnquiryNote(id, notes)
    },
    [addEnquiryNote]
  )

  const deleteEnquiry = useCallback(
    async () => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Access denied: Superadministrator privileges required to delete enquiry.')
      }

      throw new Error(
        'Direct table deletion is permanently disabled. Enquiries must be processed through the completion review workflow into the Bin, where they are retained for 7 days before automated purge.'
      )
    },
    [adminUser]
  )

  // --- Register Staff Member Profile in public.admin_users (Superadmin Only, Permitted roles: 'admin' | 'inventory_staff') ---
  const addStaffMember = useCallback(
    async ({ id, email, fullName, role = 'admin' }) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can register staff profiles.')
      }

      const cleanId = typeof id === 'string' ? id.trim() : ''
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (isLiveDatabase) {
        if (!cleanId || !uuidRegex.test(cleanId)) {
          throw new Error('Invalid Auth User ID: Must be a valid 36-character UUID from Supabase Authentication.')
        }
      } else {
        if (!cleanId || cleanId.length < 3) {
          throw new Error('Please enter a valid identifier or UUID for this demo staff member.')
        }
      }

      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        throw new Error('Please enter a valid staff email address.')
      }

      const cleanFullName = typeof fullName === 'string' ? fullName.trim() : ''
      if (!cleanFullName || cleanFullName.length < 2 || cleanFullName.length > 100) {
        throw new Error('Staff full name must be between 2 and 100 characters.')
      }

      const PERMITTED_ROLES = ['admin', 'inventory_staff']
      if (!PERMITTED_ROLES.includes(role)) {
        throw new Error(`Invalid role assignment: "${role}". Permitted roles are "admin" or "inventory_staff".`)
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase
          .from('admin_users')
          .insert({
            id: cleanId,
            email: cleanEmail,
            full_name: cleanFullName,
            role,
            is_active: true
          })
          .select('id, email, full_name, role, is_active, created_at, updated_at')
          .single()

        if (error) {
          if (error.code === '23505') {
            throw new Error('A staff profile with this Auth User ID or email address already exists in the directory.')
          }
          if (error.code === '23503') {
            throw new Error('The specified Auth User ID does not exist in Supabase Authentication. Please create the user in Supabase Auth first.')
          }
          throw error
        }

        setLiveStaff((prev) => [data, ...prev.filter((item) => item.id !== data.id)])
        return data
      }

      // Demo Mode Mutation
      const newStaffMember = {
        id: cleanId,
        email: cleanEmail,
        full_name: cleanFullName,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setDemoStaff((prev) => [newStaffMember, ...prev.filter((item) => item.id !== cleanId)])
      return newStaffMember
    },
    [isLiveDatabase, adminUser]
  )

  // --- Update Staff Role (Superadmin Only, Permitted roles: 'admin' | 'inventory_staff') ---
  const updateStaffRole = useCallback(
    async (staffId, newRole) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can modify staff roles.')
      }
      if (staffId === adminUser?.id) {
        throw new Error('Safety violation: You cannot demote or alter your own superadministrator role.')
      }
      const PERMITTED_ROLES = ['admin', 'inventory_staff']
      if (!PERMITTED_ROLES.includes(newRole)) {
        throw new Error(`Invalid role assignment: "${newRole}". Permitted roles are "admin" or "inventory_staff".`)
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase
          .from('admin_users')
          .update({ role: newRole })
          .eq('id', staffId)
          .select('id, email, full_name, role, is_active, created_at, updated_at')
          .single()

        if (error) {
          throw error
        }

        setLiveStaff((prev) =>
          prev.map((item) => (item.id === staffId ? { ...item, ...data } : item))
        )
        return data
      }

      // Demo Mode Mutation
      const updatedTime = new Date().toISOString()
      setDemoStaff((prev) =>
        prev.map((item) =>
          item.id === staffId ? { ...item, role: newRole, updated_at: updatedTime } : item
        )
      )
    },
    [isLiveDatabase, adminUser]
  )

  // --- Toggle Staff Active Status (Superadmin Only, Prevents self-deactivation & last superadmin lockout) ---
  const toggleStaffActive = useCallback(
    async (staffId, newStatus) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can activate or deactivate staff accounts.')
      }
      if (staffId === adminUser?.id) {
        throw new Error('Safety violation: You cannot deactivate your own superadministrator account.')
      }

      const activeList = isLiveDatabase ? liveStaff : demoStaff
      const targetUser = activeList.find((s) => s.id === staffId)
      if (targetUser?.role === 'superadmin' && newStatus === false) {
        const activeSuperadmins = activeList.filter(
          (s) => s.role === 'superadmin' && s.is_active === true
        )
        if (activeSuperadmins.length <= 1) {
          throw new Error('Safety violation: Cannot deactivate the last remaining active superadministrator.')
        }
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase
          .from('admin_users')
          .update({ is_active: Boolean(newStatus) })
          .eq('id', staffId)
          .select('id, email, full_name, role, is_active, created_at, updated_at')
          .single()

        if (error) {
          throw error
        }

        setLiveStaff((prev) =>
          prev.map((item) => (item.id === staffId ? { ...item, ...data } : item))
        )
        return data
      }

      // Demo Mode Mutation
      const updatedTime = new Date().toISOString()
      setDemoStaff((prev) =>
        prev.map((item) =>
          item.id === staffId
            ? { ...item, is_active: Boolean(newStatus), updated_at: updatedTime }
            : item
        )
      )
    },
    [isLiveDatabase, adminUser, liveStaff, demoStaff]
  )

  // ==========================================================================
  // SERVICE REQUEST MUTATORS & WORKFLOW ACTIONS
  // ==========================================================================

  // 1. Create a Customer Service Request (Public & Admin)
  const createServiceRequest = useCallback(
    async (requestData) => {
      // Validate customer name
      const cleanName = typeof requestData.customer_name === 'string' ? requestData.customer_name.trim() : ''
      if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
        throw new Error('Please enter a valid customer name (2 to 100 characters).')
      }

      // Validate mobile number
      const cleanMobile = typeof requestData.mobile_number === 'string' ? requestData.mobile_number.trim() : ''
      if (!cleanMobile || cleanMobile.length < 8 || cleanMobile.length > 20) {
        throw new Error('Please enter a valid contact mobile number.')
      }

      // Validate problem description
      const cleanProblem = typeof requestData.problem_description === 'string' ? requestData.problem_description.trim() : ''
      if (!cleanProblem || cleanProblem.length < 10) {
        throw new Error('Please provide a descriptive explanation of the hardware problem (at least 10 characters).')
      }

      // Live Supabase Insert
      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const payload = {
          customer_name: cleanName,
          mobile_number: cleanMobile,
          email: requestData.email ? requestData.email.trim().toLowerCase() : null,
          customer_type: requestData.customer_type || 'Individual',
          product_category: requestData.product_category,
          brand: requestData.brand ? requestData.brand.trim() : null,
          model_number: requestData.model_number ? requestData.model_number.trim() : null,
          serial_number: requestData.serial_number ? requestData.serial_number.trim() : null,
          purchase_date: requestData.purchase_date || null,
          invoice_number: requestData.invoice_number ? requestData.invoice_number.trim() : null,
          request_type: requestData.request_type || 'Repair/Fault Diagnosis',
          problem_description: cleanProblem,
          service_location: requestData.service_location || 'On-site',
          site_address: requestData.site_address ? requestData.site_address.trim() : null,
          preferred_visit_date: requestData.preferred_visit_date || null,
          attachment_url: requestData.attachment_url || null,
          device_details: requestData.device_details || {},
          status: 'new',
          priority: 'medium',
          warranty_status: 'pending_verification'
        }

        const { data, error } = await supabase
          .from('service_requests')
          .insert(payload)
          .select('*')
          .single()

        if (error) {
          throw new Error(error.message || 'Failed to submit service request.')
        }

        await loadAdminServiceRequests()
        return { success: true, data }
      }

      // Demo Mode Insert
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const randSeq = Math.floor(1000 + Math.random() * 9000)
      const demoTicketNumber = `ARS-SR-${today}-${randSeq}`

      const newTicket = {
        id: `sr-${Date.now()}`,
        ticket_number: demoTicketNumber,
        customer_name: cleanName,
        mobile_number: cleanMobile,
        email: requestData.email ? requestData.email.trim().toLowerCase() : null,
        customer_type: requestData.customer_type || 'Individual',
        product_category: requestData.product_category,
        brand: requestData.brand || null,
        model_number: requestData.model_number || null,
        serial_number: requestData.serial_number || null,
        purchase_date: requestData.purchase_date || null,
        invoice_number: requestData.invoice_number || null,
        request_type: requestData.request_type || 'Repair/Fault Diagnosis',
        problem_description: cleanProblem,
        service_location: requestData.service_location || 'On-site',
        site_address: requestData.site_address || null,
        preferred_visit_date: requestData.preferred_visit_date || null,
        attachment_url: requestData.attachment_url || null,
        device_details: requestData.device_details || {},
        status: 'new',
        priority: 'medium',
        warranty_status: 'pending_verification',
        assigned_technician_id: null,
        assigned_technician_name: null,
        diagnosis: null,
        work_performed: null,
        parts_used: [],
        estimated_cost: null,
        final_cost: null,
        internal_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      setDemoServiceRequests((prev) => [newTicket, ...prev])
      return { success: true, data: newTicket }
    },
    [isLiveDatabase, loadAdminServiceRequests]
  )

  // 2. Assign Technician & Priority
  const assignServiceTicket = useCallback(
    async (ticketId, technicianId, priority = 'medium', notes = '') => {
      const role = adminUser?.role
      if (role !== 'superadmin' && role !== 'admin') {
        throw new Error('Access denied: Administrator privileges required to assign service tickets.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('assign_service_ticket', {
          p_ticket_id: ticketId,
          p_technician_id: technicianId,
          p_priority: priority,
          p_notes: notes || null
        })

        if (error) throw error
        await loadAdminServiceRequests()
        return data
      }

      // Demo Mode
      const assignedTech = staff.find((s) => s.id === technicianId)
      setDemoServiceRequests((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: t.status === 'new' ? 'assigned' : t.status,
                assigned_technician_id: technicianId,
                assigned_technician_name: assignedTech?.full_name || assignedTech?.name || 'Assigned Technician',
                priority,
                internal_notes: notes
                  ? `${t.internal_notes ? `${t.internal_notes}\n---\n` : ''}[${new Date().toISOString().slice(0, 10)} - ${adminUser?.fullName || 'Staff'}]: ${notes}`
                  : t.internal_notes,
                updated_at: new Date().toISOString()
              }
            : t
        )
      )
      return { success: true }
    },
    [isLiveDatabase, adminUser, staff, loadAdminServiceRequests]
  )

  // 3. Update Ticket Status (with notes & diagnosis)
  const updateServiceTicketStatus = useCallback(
    async (ticketId, newStatus, notes = '', diagnosis = '', workPerformed = '') => {
      if (!adminUser) {
        throw new Error('Authentication required to update ticket status.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('update_service_ticket_status', {
          p_ticket_id: ticketId,
          p_new_status: newStatus,
          p_notes: notes || null,
          p_diagnosis: diagnosis || null,
          p_work_performed: workPerformed || null
        })

        if (error) throw error
        await loadAdminServiceRequests()
        return data
      }

      // Demo Mode
      setDemoServiceRequests((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: newStatus,
                diagnosis: diagnosis || t.diagnosis,
                work_performed: workPerformed || t.work_performed,
                resolved_at: newStatus === 'resolved' ? new Date().toISOString() : t.resolved_at,
                internal_notes: notes
                  ? `${t.internal_notes ? `${t.internal_notes}\n---\n` : ''}[${new Date().toISOString().slice(0, 10)} - ${adminUser?.fullName || 'Staff'}]: ${notes}`
                  : t.internal_notes,
                updated_at: new Date().toISOString()
              }
            : t
        )
      )
      return { success: true }
    },
    [isLiveDatabase, adminUser, loadAdminServiceRequests]
  )

  // 4. Update Technical Details (Diagnosis, Work, Parts, Cost, Warranty)
  const updateServiceTicketTechnicalDetails = useCallback(
    async (ticketId, details) => {
      if (!adminUser) {
        throw new Error('Authentication required to modify technical details.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const updatePayload = {
          diagnosis: details.diagnosis ?? undefined,
          work_performed: details.work_performed ?? undefined,
          parts_used: details.parts_used ?? undefined,
          estimated_cost: details.estimated_cost !== undefined ? details.estimated_cost : undefined,
          final_cost: details.final_cost !== undefined ? details.final_cost : undefined,
          warranty_status: details.warranty_status ?? undefined,
          warranty_notes: details.warranty_notes ?? undefined,
          updated_at: new Date().toISOString()
        }

        // Clean out undefined keys
        Object.keys(updatePayload).forEach((k) => updatePayload[k] === undefined && delete updatePayload[k])

        const { data, error } = await supabase
          .from('service_requests')
          .update(updatePayload)
          .eq('id', ticketId)
          .select('*')
          .single()

        if (error) throw error
        await loadAdminServiceRequests()
        return data
      }

      // Demo Mode
      setDemoServiceRequests((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                ...details,
                updated_at: new Date().toISOString()
              }
            : t
        )
      )
      return { success: true }
    },
    [isLiveDatabase, adminUser, loadAdminServiceRequests]
  )

  // 5. Add Internal Private Note
  const addServiceTicketNote = useCallback(
    async (ticketId, note) => {
      const cleanNote = typeof note === 'string' ? note.trim() : ''
      if (!cleanNote || cleanNote.length < 2) {
        throw new Error('Please enter a note of at least 2 characters.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('add_service_ticket_note', {
          p_ticket_id: ticketId,
          p_note: cleanNote
        })

        if (error) throw error
        await loadAdminServiceRequests()
        return data
      }

      // Demo Mode
      setDemoServiceRequests((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                internal_notes: `${t.internal_notes ? `${t.internal_notes}\n---\n` : ''}[${new Date().toISOString().slice(0, 10)} - ${adminUser?.fullName || 'Staff'}]: ${cleanNote}`,
                updated_at: new Date().toISOString()
              }
            : t
        )
      )
      return { success: true }
    },
    [isLiveDatabase, adminUser, loadAdminServiceRequests]
  )

  // 6. Close Service Ticket (Superadmin Only)
  const closeServiceTicket = useCallback(
    async (ticketId, resolutionSummary, finalCost = null) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can close service tickets.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('close_service_ticket', {
          p_ticket_id: ticketId,
          p_resolution_summary: resolutionSummary || null,
          p_final_cost: finalCost !== null ? Number(finalCost) : null
        })

        if (error) throw error
        await loadAdminServiceRequests()
        return data
      }

      // Demo Mode
      setDemoServiceRequests((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: 'closed',
                resolution_summary: resolutionSummary || t.resolution_summary,
                final_cost: finalCost !== null ? Number(finalCost) : t.final_cost,
                closed_at: new Date().toISOString(),
                closed_by: adminUser?.id,
                updated_at: new Date().toISOString()
              }
            : t
        )
      )
      return { success: true }
    },
    [isLiveDatabase, adminUser, loadAdminServiceRequests]
  )

  // 7. Reopen Closed Service Ticket (Superadmin Only)
  const reopenServiceTicket = useCallback(
    async (ticketId, reason) => {
      if (adminUser?.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadministrators can reopen closed service tickets.')
      }

      const cleanReason = typeof reason === 'string' ? reason.trim() : ''
      if (!cleanReason || cleanReason.length < 5) {
        throw new Error('A mandatory reopen reason of at least 5 characters is required.')
      }

      if (isLiveDatabase) {
        if (!supabase) throw new Error('Supabase client is not available.')

        const { data, error } = await supabase.rpc('reopen_service_ticket', {
          p_ticket_id: ticketId,
          p_reason: cleanReason
        })

        if (error) throw error
        await loadAdminServiceRequests()
        return data
      }

      // Demo Mode
      setDemoServiceRequests((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: 'in_progress',
                reopen_reason: cleanReason,
                reopened_at: new Date().toISOString(),
                reopened_by: adminUser?.id,
                updated_at: new Date().toISOString()
              }
            : t
        )
      )
      return { success: true }
    },
    [isLiveDatabase, adminUser, loadAdminServiceRequests]
  )

  // --- Reset All Demo State ---
  const resetDemoData = useCallback(() => {
    if (isLiveDatabase) {
      loadAdminProducts({ page: 1, limit: 50 })
      if (adminUser?.role === 'superadmin' || adminUser?.role === 'admin') {
        loadAdminEnquiries()
      }
      if (adminUser?.role === 'superadmin') {
        loadAdminStaff()
      }
      if (adminUser?.role === 'superadmin' || adminUser?.role === 'admin' || adminUser?.role === 'inventory_staff') {
        loadAdminServiceRequests()
      }
      return
    }
    const freshCategories = INITIAL_CATEGORIES.map((c) => ({
      ...c,
      is_active: c.is_active ?? true
    }))
    setDemoProducts(INITIAL_DEMO_PRODUCTS)
    setDemoCategories(freshCategories)
    setDemoEnquiries(INITIAL_DEMO_ENQUIRIES)
    setDemoStaff(INITIAL_DEMO_STAFF)
    setDemoServiceRequests(INITIAL_DEMO_SERVICE_REQUESTS)
    try {
      localStorage.removeItem(STORAGE_KEYS.PRODUCTS)
      localStorage.removeItem(STORAGE_KEYS.CATEGORIES)
      localStorage.removeItem(STORAGE_KEYS.ENQUIRIES)
      localStorage.removeItem(STORAGE_KEYS.STAFF)
      localStorage.removeItem(STORAGE_KEYS.SERVICE_REQUESTS)
    } catch (e) {
      console.warn('[AdminDataProvider] Failed to clear demo localStorage keys:', e)
    }
  }, [isLiveDatabase, adminUser, loadAdminProducts, loadAdminEnquiries, loadAdminStaff, loadAdminServiceRequests])

  // --- Consistent Derived Metrics ---
  const metrics = useMemo(() => {
    const totalProducts = products.length
    const activeProducts = products.filter((p) => p.is_active !== false).length
    const inactiveProducts = products.filter((p) => p.is_active === false).length

    // Low stock: active physical stock item, stock <= min alert threshold
    const lowStockItems = products.filter(
      (p) =>
        p.is_active !== false &&
        p.availability_status !== 'discontinued' &&
        p.availability_status !== 'on_demand' &&
        Number(p.stock_quantity) <= Number(p.min_stock_alert)
    )

    const inStockItems = products.filter((p) => p.availability_status === 'in_stock')
    const outOfStockItems = products.filter(
      (p) =>
        p.availability_status === 'out_of_stock' ||
        (p.availability_status !== 'on_demand' && Number(p.stock_quantity) === 0)
    )
    const onDemandItems = products.filter((p) => p.availability_status === 'on_demand')

    const totalCategories = categories.length
    const activeCategories = categories.filter((c) => c.is_active !== false).length

    const activeEnquiries = enquiries.filter((e) => !e.is_archived)
    const totalEnquiries = activeEnquiries.length
    const newEnquiries = activeEnquiries.filter((e) => e.status === 'new').length
    const inProgressEnquiries = activeEnquiries.filter((e) => e.status === 'in_progress').length
    const quotedEnquiries = activeEnquiries.filter((e) => e.status === 'quoted').length
    const closedEnquiries = activeEnquiries.filter((e) => e.status === 'closed' || e.status === 'rejected').length
    const pendingRejectionEnquiries = activeEnquiries.filter((e) => e.status === 'rejection_requested').length
    const archivedEnquiries = enquiries.filter((e) => e.is_archived).length

    const totalStaff = staff.length
    const activeStaff = staff.filter((s) => s.is_active !== false).length
    const inactiveStaff = staff.filter((s) => s.is_active === false).length
    const superadmins = staff.filter((s) => s.role === 'superadmin').length
    const admins = staff.filter((s) => s.role === 'admin').length
    const inventoryStaff = staff.filter((s) => s.role === 'inventory_staff').length

    const totalServiceRequests = serviceRequests.length
    const newServiceRequests = serviceRequests.filter((s) => s.status === 'new').length
    const assignedServiceRequests = serviceRequests.filter((s) => s.status === 'assigned').length
    const inProgressServiceRequests = serviceRequests.filter((s) => s.status === 'in_progress').length
    const waitingServiceRequests = serviceRequests.filter((s) => s.status === 'waiting_customer_parts').length
    const resolvedServiceRequests = serviceRequests.filter((s) => s.status === 'resolved').length
    const closedServiceRequests = serviceRequests.filter((s) => s.status === 'closed').length

    return {
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: inactiveProducts,
        lowStock: lowStockItems.length,
        inStock: inStockItems.length,
        outOfStock: outOfStockItems.length,
        onDemand: onDemandItems.length,
        lowStockList: lowStockItems
      },
      categories: {
        total: totalCategories,
        active: activeCategories
      },
      enquiries: {
        total: totalEnquiries,
        newCount: newEnquiries,
        inProgress: inProgressEnquiries,
        quoted: quotedEnquiries,
        closed: closedEnquiries,
        pendingRejection: pendingRejectionEnquiries,
        archived: archivedEnquiries
      },
      staff: {
        total: totalStaff,
        active: activeStaff,
        inactive: inactiveStaff,
        superadmins,
        admins,
        inventoryStaff
      },
      serviceRequests: {
        total: totalServiceRequests,
        newCount: newServiceRequests,
        assigned: assignedServiceRequests,
        inProgress: inProgressServiceRequests,
        waiting: waitingServiceRequests,
        resolved: resolvedServiceRequests,
        closed: closedServiceRequests,
        pending: newServiceRequests + assignedServiceRequests + inProgressServiceRequests + waitingServiceRequests
      }
    }
  }, [products, categories, enquiries, staff, serviceRequests])

  const value = {
    // Datasets
    products,
    categories,
    enquiries,
    staff,
    serviceRequests,

    // Live Database Metadata & Handlers
    isLiveDatabase,
    dataSource,
    isLoadingProducts,
    isLoadingCategories,
    isLoadingEnquiries,
    isLoadingStaff,
    isLoadingServiceRequests,
    databaseError,
    enquiriesError,
    staffError,
    serviceRequestsError,
    isPermissionDenied,
    pagination,
    loadAdminCatalog: loadAdminProducts,
    loadAdminCategories,
    loadAdminEnquiries,
    loadAdminStaff,
    loadAdminServiceRequests,
    findCategory,

    // Product Mutators
    setProducts: setDemoProducts,
    addProduct,
    updateProduct,
    updateProductStock,
    toggleProductActive,
    softDeleteProduct,
    reactivateProduct,
    hardDeleteProduct,

    // Category Mutators
    setCategories: setDemoCategories,
    addCategory,
    updateCategory,
    toggleCategoryActive,

    // Enquiry Mutators & Workflow Actions (Phase 2 & Phase 3)
    setEnquiries: setDemoEnquiries,
    updateEnquiryStatus,
    updateEnquiryNotes,
    deleteEnquiry,
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

    // Staff Mutators (Superadmin Only)
    setStaff: setDemoStaff,
    addStaffMember,
    updateStaffRole,
    toggleStaffActive,

    // Service Request Mutators & Actions
    createServiceRequest,
    assignServiceTicket,
    updateServiceTicketStatus,
    updateServiceTicketTechnicalDetails,
    addServiceTicketNote,
    closeServiceTicket,
    reopenServiceTicket,

    // Role Permission Capabilities
    isSuperadmin: adminUser?.role === 'superadmin',
    isAdminEmployee: adminUser?.role === 'admin',
    isInventoryStaff: adminUser?.role === 'inventory_staff',
    canWriteCatalog: adminUser?.role === 'superadmin',
    canWriteCategories: adminUser?.role === 'superadmin',
    canWriteEnquiries: adminUser?.role === 'superadmin',
    canWriteInventory: adminUser?.role === 'superadmin' || adminUser?.role === 'inventory_staff',
    canManageStaff: adminUser?.role === 'superadmin',

    // Global
    metrics,
    resetDemoData
  }

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  )
}


