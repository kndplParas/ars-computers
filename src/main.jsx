import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'

// Centralized Vite chunk recovery for deployment transitions
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    const RECOVERY_KEY = 'ars_chunk_reload_attempted'

    // Guard: allow only ONE automatic reload attempt per tab/session
    let alreadyAttempted = false
    try {
      alreadyAttempted = sessionStorage.getItem(RECOVERY_KEY) === 'true'
    } catch (_) {
      // sessionStorage unavailable or restricted
    }

    if (!alreadyAttempted) {
      try {
        sessionStorage.setItem(RECOVERY_KEY, 'true')
      } catch (_) {}
      window.location.reload()
    } else {
      console.warn(
        '[Vite Preload] Automatic reload already attempted for this session. Deferring to ErrorBoundary for manual recovery.'
      )
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
