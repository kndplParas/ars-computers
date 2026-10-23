import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchPublicCatalog } from '../lib/catalog'
import { CATEGORIES } from '../data/categories'

const CURRENT_YEAR = new Date().getFullYear()

export default function SiteFooter() {
  const navigate = useNavigate()
  const location = useLocation()
  const [categories, setCategories] = useState(CATEGORIES)

  useEffect(() => {
    let isMounted = true
    async function loadCats() {
      try {
        const res = await fetchPublicCatalog()
        if (isMounted && res.categories && res.categories.length > 0) {
          setCategories(res.categories)
        }
      } catch (err) {
        console.warn('SiteFooter catalog load warning:', err)
      }
    }
    loadCats()
    return () => {
      isMounted = false
    }
  }, [])

  const handleNavClick = (sectionId) => {
    if (location.pathname === '/') {
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      navigate(sectionId === 'home' ? '/' : `/#${sectionId}`)
    }
  }

  const handleCategoryNav = (slug) => {
    navigate(`/category/${slug}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="brand-logo" onClick={() => handleNavClick('home')}>
            <img
              src="/logo.svg"
              alt="ARS Computers Logo"
              className="brand-logo-img"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className="brand-text">
              <h1>ARS Computers</h1>
              <span className="brand-subtitle">IT &amp; Security Systems</span>
            </div>
          </div>
          <p>
            Delivering high-performance computing, smart surveillance, and enterprise hardware
            solutions with certified technical expertise.
          </p>
        </div>

        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><button onClick={() => handleNavClick('home')}>Home</button></li>
            <li><button onClick={() => handleNavClick('about')}>About Us</button></li>
            <li><button onClick={() => handleNavClick('products')}>Product Catalog</button></li>
            <li><button onClick={() => handleNavClick('services')}>Services &amp; AMC</button></li>
            <li><button onClick={() => handleNavClick('contact')}>Contact &amp; Quotes</button></li>
            <li><button onClick={() => navigate('/admin')} style={{ color: '#0284c7', fontWeight: 600 }}>🔒 Staff Admin Portal</button></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Product Categories</h4>
          <ul>
            {categories.map((c) => (
              <li key={c.id || c.slug}>
                <button onClick={() => handleCategoryNav(c.slug || c.id)}>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-col footer-contact-col">
          <h4>Showroom &amp; Service Center</h4>
          <div className="footer-contact-details">
            <div className="footer-contact-row">
              <span className="footer-contact-icon">📍</span>
              <p>Near Hanuman Mandir, Shri Ram Market, Sidcul, Rudrapur, U.S. Nagar, Uttarakhand - 263153</p>
            </div>
            <div className="footer-contact-row">
              <span className="footer-contact-icon">📞</span>
              <p>
                <a href="tel:+917078382213">+91 7078382213</a>,{' '}
                <a href="tel:+919568799107">+91 9568799107</a>
              </p>
            </div>
            <div className="footer-contact-row">
              <span className="footer-contact-icon">✉️</span>
              <p>
                <a href="mailto:arscomputer.ukdrdr@gmail.com">arscomputer.ukdrdr@gmail.com</a>
              </p>
            </div>
            <div className="footer-contact-row">
              <span className="footer-contact-icon">⏰</span>
              <p>Mon - Sat: 9:30 AM - 8:30 PM (Sunday Closed)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>&copy; {CURRENT_YEAR} ARS Computers. All rights reserved.</span>
        <span>GSTIN: 05FFNPB4737Q12V</span>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', padding: '4px 8px', borderRadius: '4px' }}
          title="Staff &amp; Operations Portal"
        >
          Staff Portal ↗
        </button>
        <span>Authorized Dealer &amp; System Integrator</span>
      </div>
    </footer>
  )
}
