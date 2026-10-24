import { createContext, useContext } from 'react'

/**
 * ============================================================================
 * ARS Computers — Admin Authentication Context & Hook
 * ============================================================================
 * 
 * SECURITY NOTICE:
 * This context provides client-side route guard state and interactive session
 * management for UI prototyping and workflow testing.
 * 
 * It DOES NOT provide cryptographically verified authorization.
 * True security will be enforced at the database layer via Supabase Auth JWTs
 * and PostgreSQL Row Level Security (RLS) in Step 3B.
 * ============================================================================
 */
export const AdminAuthContext = createContext(null)

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return ctx
}
