import { Link } from 'react-router-dom'
import '../App.css'

function NotFoundPage() {
  return (
    <div className="not-found-container">
      <div className="not-found-card">
        <div className="not-found-code">404</div>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-desc">
          The requested URL does not exist or may have been moved.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-primary">
            Back to Home
          </Link>
          <Link to="/admin" className="btn-outline">
            Admin Portal
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
