import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchPublicCatalog } from '../lib/catalog'
import { CATEGORIES } from '../data/categories'
import ProductSearch from './ProductSearch'

export default function SiteHeader({ activeSection = '', selectedCategory = '' }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [categories, setCategories] = useState(CATEGORIES)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  const dropdownRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    async function loadCats() {
      try {
        const res = await fetchPublicCatalog()
        if (isMounted && res.categories && res.categories.length > 0) {
          setCategories(res.categories)
        }
      } catch (err) {
        console.warn('SiteHeader catalog load warning:', err)
      }
    }
    loadCats()
    return () => {
      isMounted = false
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const closeMenus = () => {
    setIsDropdownOpen(false)
    setIsMobileMenuOpen(false)
    setMobileProductsOpen(false)
    setIsMobileSearchOpen(false)
  }

  const handleNavClick = (sectionId) => {
    closeMenus()

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
    closeMenus()
    navigate(`/category/${slug}`)
  }

  const handleAllProductsNav = () => {
    closeMenus()
    if (location.pathname === '/') {
      const el = document.getElementById('products')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      navigate('/#products')
    }
  }

  return (
    <header className="site-header">
      <div className="header-content">
        <div
          className="brand-logo header-brand-logo"
          onClick={() => handleNavClick('home')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNavClick('home') }}
          aria-label="ARS Computers Home"
        >
          <img
            src="/logo.svg"
            alt="ARS Computers Flower Symbol"
            className="ars-logo-flower"
            width="54"
            height="54"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <div className="brand-text">
            <h1 className="brand-title">ARS Computers</h1>
            <span className="brand-subtitle">IT &amp; SECURITY SYSTEMS</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="header-nav" aria-label="Main Navigation">
          {/* 1. Home */}
          <button
            className={`nav-link-btn ${activeSection === 'home' && location.pathname === '/' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            Home
          </button>

          {/* 2. About */}
          <button
            className={`nav-link-btn ${activeSection === 'about' ? 'active' : ''}`}
            onClick={() => handleNavClick('about')}
          >
            About
          </button>

          {/* 3. Products (with Dropdown) */}
          <div
            className={`nav-dropdown ${isDropdownOpen ? 'open' : ''}`}
            ref={dropdownRef}
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <button
              className={`nav-link-btn dropdown-toggle ${
                location.pathname.startsWith('/category') ||
                location.pathname.startsWith('/products') ||
                activeSection === 'products'
                  ? 'active'
                  : ''
              }`}
              onClick={() => setIsDropdownOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
            >
              <span>Products</span>
              <span className={`dropdown-chevron ${isDropdownOpen ? 'rotated' : ''}`}>▾</span>
            </button>

            <div className="dropdown-menu" role="menu">
              <div className="dropdown-header">
                <span>Product Categories</span>
                <button
                  className="dropdown-all-btn"
                  onClick={handleAllProductsNav}
                >
                  View All
                </button>
              </div>
              <div className="dropdown-items">
                {categories.map((cat) => (
                  <button
                    key={cat.id || cat.slug}
                    className={`dropdown-item ${selectedCategory === cat.slug || selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => handleCategoryNav(cat.slug || cat.id)}
                    role="menuitem"
                  >
                    <span className="dropdown-item-icon">{cat.icon}</span>
                    <div className="dropdown-item-info">
                      <span className="dropdown-item-title">{cat.title}</span>
                      <span className="dropdown-item-desc">{cat.badge || 'Browse Products'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Services */}
          <button
            className={`nav-link-btn ${activeSection === 'services' ? 'active' : ''}`}
            onClick={() => handleNavClick('services')}
          >
            Services
          </button>

          {/* 5. Contact */}
          <button
            className={`nav-link-btn ${activeSection === 'contact' ? 'active' : ''}`}
            onClick={() => handleNavClick('contact')}
          >
            Contact
          </button>
        </nav>

        <div className="header-actions">
          {/* Desktop Search Engine */}
          <div className="desktop-search-wrapper desktop-only">
            <ProductSearch categories={categories} onNavigate={closeMenus} />
          </div>

          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            className={`mobile-search-toggle-btn ${isMobileSearchOpen ? 'active' : ''}`}
            onClick={() => {
              setIsMobileSearchOpen((prev) => !prev)
              if (isMobileMenuOpen) setIsMobileMenuOpen(false)
            }}
            aria-label="Toggle hardware search"
            aria-expanded={isMobileSearchOpen}
          >
            <span aria-hidden="true">{isMobileSearchOpen ? '✕' : '🔍'}</span>
          </button>

          {/* Mobile Hamburger Button */}
          <button
            className={`hamburger-btn ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setIsMobileMenuOpen((prev) => !prev)
              if (isMobileSearchOpen) setIsMobileSearchOpen(false)
            }}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        </div>
      </div>

      {/* Mobile Top Search Bar (revealed when search icon is clicked) */}
      {isMobileSearchOpen && (
        <div className="mobile-header-search-bar">
          <ProductSearch
            categories={categories}
            onNavigate={closeMenus}
            isMobileDrawer
            placeholder="Search products..."
          />
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-links">
          {/* Quick search input inside mobile drawer */}
          <div className="mobile-drawer-search-wrap">
            <ProductSearch
              categories={categories}
              onNavigate={closeMenus}
              isMobileDrawer
              placeholder="Search products..."
            />
          </div>

          <button
            className="mobile-nav-item"
            onClick={() => handleNavClick('home')}
          >
            Home
          </button>

          <button
            className="mobile-nav-item"
            onClick={() => handleNavClick('about')}
          >
            About
          </button>

          {/* Mobile Products Expandable Item */}
          <div className="mobile-dropdown-group">
            <button
              className="mobile-nav-item mobile-dropdown-toggle"
              onClick={() => setMobileProductsOpen(prev => !prev)}
            >
              <span>Products</span>
              <span className={`dropdown-chevron ${mobileProductsOpen ? 'rotated' : ''}`}>▾</span>
            </button>

            {mobileProductsOpen && (
              <div className="mobile-submenu">
                <button
                  className="mobile-submenu-item"
                  onClick={handleAllProductsNav}
                >
                  <span>⚡</span> All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id || cat.slug}
                    className={`mobile-submenu-item ${selectedCategory === cat.slug || selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => handleCategoryNav(cat.slug || cat.id)}
                  >
                    <span>{cat.icon}</span> {cat.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="mobile-nav-item"
            onClick={() => handleNavClick('services')}
          >
            Services &amp; AMC
          </button>

          <button
            className="mobile-nav-item"
            onClick={() => handleNavClick('contact')}
          >
            Contact Desk
          </button>
        </div>
      </div>
    </header>
  )
}
