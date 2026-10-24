import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../context/adminAuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'

/**
 * ============================================================================
 * ARS Computers — Admin Login Page (Supabase Authentication)
 * ============================================================================
 * Features:
 * - Real Supabase signInWithPassword() authentication
 * - Server-side database verification against public.admin_users
 * - Email & Password validation with real-time feedback
 * - Show / Hide password toggle button
 * - Loading indicator during authentication verification
 * - Inline error alerts with strict denial handling
 * ============================================================================
 */
function AdminLoginPage() {
  const { login, loginOfflineDemo, isLoading, isAuthenticated } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect destination after successful login (sanitized to avoid login loops)
  const rawFrom = location.state?.from?.pathname
  const destination = rawFrom && rawFrom !== '/admin/login' ? rawFrom : '/admin/dashboard'

  // If already authenticated, redirect safely in useEffect
  useEffect(() => {
    if (isAuthenticated && !isSubmitting) {
      navigate(destination, { replace: true })
    }
  }, [isAuthenticated, isSubmitting, navigate, destination])

  const validate = () => {
    if (!email.trim()) {
      return 'Please enter your administrator email.'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address.'
    }
    if (!password) {
      return 'Please enter your password.'
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters.'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setIsSubmitting(true)
      const user = await login(email, password)
      if (!user) {
        throw new Error('Access denied: Unable to verify your staff administrator profile.')
      }
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        {/* Brand Header */}
        <div className="admin-login-brand">
          <img
            src="/logo.svg"
            alt="ARS Computers Flower Symbol"
            className="ars-logo-flower admin-login-flower"
            width="56"
            height="56"
          />
          <div className="admin-login-brand-text">
            <h1 className="admin-login-title">ARS Computers</h1>
            <p className="admin-login-subtitle">IT &amp; SECURITY SYSTEMS</p>
            <span className="admin-login-badge">Staff &amp; Operations Portal</span>
          </div>
        </div>

        {/* Phase / Supabase Status Notice */}
        <div className="admin-login-notice">
          <span className="notice-icon" aria-hidden="true">{isSupabaseConfigured ? '🔐' : '⚠️'}</span>
          <div>
            <strong>{isSupabaseConfigured ? 'Supabase Authentication Active:' : 'Configuration Required:'}</strong>
            <p>
              {isSupabaseConfigured
                ? 'Sign in using your authorized staff credentials. Access permissions are verified directly from the database security catalog (public.admin_users).'
                : 'Supabase credentials are not detected. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local environment.'}
            </p>
          </div>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="admin-login-alert error" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span className="alert-icon">⚠️</span>
              <span>{error}</span>
            </div>
            {error.includes('authentication server') && loginOfflineDemo && (
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: '#7f1d1d' }}>
                  Backend service offline? You can preview and test administrative features using local demo mode:
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '5px 12px', background: '#ffffff' }}
                    onClick={() => {
                      loginOfflineDemo('superadmin')
                      navigate(destination, { replace: true })
                    }}
                  >
                    Enter as Superadmin (Demo)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '5px 12px', background: '#ffffff' }}
                    onClick={() => {
                      loginOfflineDemo('admin')
                      navigate(destination, { replace: true })
                    }}
                  >
                    Enter as Operations Admin (Demo)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Login Form */}
        <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-group">
            <label htmlFor="admin-email" className="admin-form-label">
              Staff Email Address
            </label>
            <input
              id="admin-email"
              type="email"
              className="admin-form-input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              placeholder="admin@arscomputers.com"
              disabled={isSubmitting || isLoading}
              autoComplete="username"
              required
            />
          </div>

          <div className="admin-form-group">
            <div className="admin-password-label-row">
              <label htmlFor="admin-password" className="admin-form-label">
                Password
              </label>
              <button
                type="button"
                className="admin-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
            <div className="admin-password-input-wrap">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="admin-form-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="••••••••••••"
                disabled={isSubmitting || isLoading}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full admin-login-submit-btn"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <span className="login-btn-loading">
                <span className="admin-spinner-sm" aria-hidden="true"></span>
                <span>Authenticating...</span>
              </span>
            ) : (
              <span>Sign In to Admin Console →</span>
            )}
          </button>
        </form>

        {/* Card Footer */}
        <div className="admin-login-card-footer">
          <Link to="/" className="admin-back-link">
            ← Return to Customer Website
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage
