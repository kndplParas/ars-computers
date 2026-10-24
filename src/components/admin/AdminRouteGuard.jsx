import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAdminAuth } from '../../context/adminAuthContext'

/**
 * ============================================================================
 * ARS Computers — Admin Route Guard (Client-Side Scaffold)
 * ============================================================================
 * 
 * SECURITY NOTICE:
 * This component acts as a user-experience routing guard to prevent unauthenticated
 * browsing of administrative screens.
 * 
 * CRITICAL LIMITATION:
 * Client-side route guards do NOT provide true system security.
 * True authorization will be enforced at the database layer via Supabase Auth JWTs
 * and PostgreSQL Row Level Security (RLS) policies drafted in Step 2E.
 * ============================================================================
 */
export default function AdminRouteGuard({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, adminUser } = useAdminAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">
          <div className="admin-spinner"></div>
          <p>Verifying admin session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  // Role-based route authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = adminUser?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      const fallbackPath = userRole === 'inventory_staff' ? '/admin/inventory' : '/admin'
      const fallbackLabel = userRole === 'inventory_staff' ? 'Inventory Management' : 'Dashboard'

      return (
        <div className="admin-page-container" style={{ padding: '60px 24px', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="admin-loading-card" style={{ maxWidth: '520px', width: '100%', margin: '0 auto', textAlign: 'center', padding: '36px 28px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <span style={{ fontSize: '2.8rem', display: 'block', marginBottom: '16px' }} role="img" aria-label="Access Restricted">
              🔒
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              Access Restricted
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Your current staff role (<strong>{userRole || 'unassigned'}</strong>) does not have authorization to view or manage this administrative module.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '24px', fontSize: '0.85rem', color: '#475569' }}>
              <span>Authorized roles for this page: </span>
              <strong>{allowedRoles.join(', ')}</strong>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link
                to={fallbackPath}
                className="btn-primary"
                style={{ padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }}
              >
                Go to {fallbackLabel}
              </Link>
            </div>
          </div>
        </div>
      )
    }
  }

  return children
}
