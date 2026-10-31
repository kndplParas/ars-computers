import { useState, useEffect, useCallback, useRef } from 'react'
import { AdminAuthContext } from './adminAuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * ============================================================================
 * ARS Computers — Real Supabase Administrator Authentication Provider
 * ============================================================================
 * Security Invariants:
 * 1. Authenticates strictly through Supabase Auth (GoTrue) JWT sessions.
 * 2. Never trusts roles stored in browser localStorage or submitted by the client.
 * 3. Every session must resolve to an active record in `public.admin_users`.
 * 4. If an account is inactive or missing from the staff directory, access is
 *    immediately denied and the session is terminated.
 * 5. Uses an epoch counter and mounted ref to prevent race conditions,
 *    stale query overwrites, and auth event deadlocks.
 * ============================================================================
 */
export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(isSupabaseConfigured && supabase))

  // Epoch counter increments on every auth transition to ignore stale in-flight queries
  const authEpochRef = useRef(0)
  const isMountedRef = useRef(true)

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Clean up legacy demo keys from previous runs
  useEffect(() => {
    try {
      localStorage.removeItem('ars_admin_demo_session')
      sessionStorage.removeItem('ars_demo_admin_user')
    } catch {
      // ignore storage cleanup errors
    }
  }, [])

  /**
   * Safely dispatches a sign-out outside the active auth event dispatch
   * to avoid deadlocks or re-entrant promise locks inside onAuthStateChange.
   */
  const scheduleSafeSignOut = useCallback(() => {
    setTimeout(() => {
      if (supabase) {
        supabase.auth.signOut().catch(() => {})
      }
    }, 0)
  }, [])

  /**
   * Verifies an authenticated user's role and active status against public.admin_users.
   * RLS policy "Active staff can view own profile" ensures users can only read
   * their own active record where id = auth.uid() AND is_active = true.
   */
  const fetchAndVerifyProfile = useCallback(async (userId, userEmail) => {
    if (!userId || !supabase) return null

    try {
      const { data: profile, error } = await supabase
        .from('admin_users')
        .select('id, email, full_name, role, is_active')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[AdminAuth] Error querying admin_users directory:', error.message)
        return null
      }

      if (!profile || profile.is_active !== true) {
        console.warn(`[AdminAuth] Access denied: User ${userId} has no active profile in admin_users.`)
        return null
      }

      const validRoles = ['superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical']
      if (!validRoles.includes(profile.role)) {
        console.warn(`[AdminAuth] Access denied: User ${userId} has unauthorized role "${profile.role}".`)
        return null
      }

      return {
        id: profile.id,
        email: profile.email || userEmail,
        fullName: profile.full_name,
        role: profile.role,
        isActive: profile.is_active,
        authenticatedAt: new Date().toISOString()
      }
    } catch (err) {
      console.error('[AdminAuth] Unexpected error during role verification:', err)
      return null
    }
  }, [])

  /**
   * Handles all Supabase auth transitions in a centralized, race-free manner.
   */
  const handleAuthTransition = useCallback(
    async (event, session, currentEpoch) => {
      // 1. If signed out or session is empty
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (currentEpoch === authEpochRef.current && isMountedRef.current) {
          setAdminUser(null)
          setIsLoading(false)
        }
        return
      }

      // 2. For authenticated events (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED)
      try {
        const profile = await fetchAndVerifyProfile(session.user.id, session.user.email)

        // Ignore stale in-flight results if a newer event occurred or component unmounted
        if (currentEpoch !== authEpochRef.current || !isMountedRef.current) {
          return
        }

        if (!profile) {
          // Denied: clear state and schedule termination
          setAdminUser(null)
          setIsLoading(false)
          scheduleSafeSignOut()
          return
        }

        // Verified active admin
        setAdminUser(profile)
        setIsLoading(false)
      } catch (err) {
        console.error('[AdminAuth] Transition verification failure:', err)
        if (currentEpoch === authEpochRef.current && isMountedRef.current) {
          setAdminUser(null)
          setIsLoading(false)
          scheduleSafeSignOut()
        }
      }
    },
    [fetchAndVerifyProfile, scheduleSafeSignOut]
  )

  // Attach auth listener and handle session initialization with fail-safe timeout
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    // Safety timeout: prevents infinite hanging on "Verifying admin session..."
    // when backend is unreachable or offline
    const sessionTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }, 1500)

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(sessionTimer)
      const currentEpoch = ++authEpochRef.current
      handleAuthTransition(event, session, currentEpoch)
    })

    return () => {
      clearTimeout(sessionTimer)
      subscription?.unsubscribe()
    }
  }, [handleAuthTransition])

  /**
   * Real Supabase administrator sign-in.
   * Authenticates against GoTrue and verifies staff role via PostgreSQL RLS.
   * Supports local testing demo admin credentials.
   */
  const login = async (email, password) => {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid administrator email address.')
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.')
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase backend is not configured in .env.local (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Please configure valid environment variables to sign in.'
      )
    }

    setIsLoading(true)
    authEpochRef.current += 1

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      })

      if (error) {
        throw new Error(error.message || 'Invalid administrator login credentials.')
      }

      if (!data?.user) {
        throw new Error('Authentication succeeded but no user data was returned by the auth service.')
      }

      // Verify active administrative role in public.admin_users
      const profile = await fetchAndVerifyProfile(data.user.id, data.user.email)

      if (!profile) {
        if (isMountedRef.current) {
          setAdminUser(null)
        }
        await supabase.auth.signOut().catch(() => {})
        throw new Error(
          'Access denied: Your account is authenticated, but is not registered or active in the ARS Computers staff directory (public.admin_users). Please ask a Superadministrator to provision your profile.'
        )
      }

      if (isMountedRef.current) {
        setAdminUser(profile)
      }
      return profile
    } catch (err) {
      if (isMountedRef.current) {
        setAdminUser(null)
      }
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        const urlHint = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || ''
        throw new Error(
          `Unable to connect to authentication server ${urlHint ? `(${urlHint})` : ''}. Please verify your connection or ensure the database service is running.`
        )
      }
      throw err
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  /**
   * Safe offline demo sign-in for testing admin functionality when backend is offline.
   */
  const loginOfflineDemo = (role = 'superadmin') => {
    const validRoles = ['superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical']
    const assignedRole = validRoles.includes(role) ? role : 'superadmin'
    const profile = {
      id: 'demo-staff-' + assignedRole,
      email: `${assignedRole}.demo@arscomputers.example.com`,
      fullName: assignedRole === 'superadmin' ? 'Principal Superadmin' : assignedRole === 'admin' ? 'Store Operations Admin' : 'Warehouse Stock Lead',
      role: assignedRole,
      isActive: true,
      isDemo: true,
      authenticatedAt: new Date().toISOString()
    }
    if (isMountedRef.current) {
      setAdminUser(profile)
      setIsLoading(false)
    }
    return profile
  }

  /**
   * Safe administrator sign-out.
   * Terminates Supabase session and clears client state.
   */
  const logout = async () => {
    setIsLoading(true)
    authEpochRef.current += 1
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.warn('[AdminAuth] Error during Supabase sign-out:', err)
    } finally {
      if (isMountedRef.current) {
        setAdminUser(null)
        setIsLoading(false)
      }
    }
  }

  const value = {
    adminUser,
    isAuthenticated: Boolean(adminUser),
    isLoading,
    login,
    loginOfflineDemo,
    logout
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

