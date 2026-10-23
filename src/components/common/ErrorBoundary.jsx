import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Global Error Boundary to catch render-phase exceptions
 * and display a smooth, helpful fallback UI instead of a blank screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="admin-page-container"
          style={{
            minHeight: '70vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '40px 32px',
              textAlign: 'center',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 20px auto'
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Something went wrong loading this view
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
              The application encountered a transient view error. Your session and database data remain completely safe.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  color: '#b91c1c',
                  marginBottom: '24px',
                  overflowX: 'auto'
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary"
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff'
                }}
              >
                🔄 Refresh Page
              </button>
              <Link
                to="/admin"
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  display: 'inline-block'
                }}
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
