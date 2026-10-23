import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchActiveCatalog } from '../lib/catalog'

export default function ProductSearch({
  categories = [],
  onNavigate = () => {},
  isMobileDrawer = false,
  placeholder = 'Search products...'
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // In-memory instant search across current active catalogue
  const searchData = useMemo(() => {
    return searchActiveCatalog(query, categories, { limit: 7 })
  }, [query, categories])

  const { results, totalMatches } = searchData

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleSelectProduct = (product) => {
    if (!product || !product.slug) return
    setIsOpen(false)
    setQuery('')
    onNavigate()
    navigate(`/products/${product.slug}`)
  }

  const handleViewAllResults = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    setIsOpen(false)
    onNavigate()
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (query.trim()) {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const maxIndex = results.length + (totalMatches > results.length ? 1 : 0) - 1
      if (maxIndex < 0) return
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const maxIndex = results.length + (totalMatches > results.length ? 1 : 0) - 1
      if (maxIndex < 0) return
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectProduct(results[selectedIndex])
      } else if (selectedIndex === results.length && totalMatches > results.length) {
        handleViewAllResults()
      } else if (query.trim()) {
        handleViewAllResults()
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setSelectedIndex(-1)
      inputRef.current?.blur()
    }
  }

  const handleClear = () => {
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const showDropdown = isOpen && query.trim().length > 0

  return (
    <div
      className={`product-search-container ${isMobileDrawer ? 'mobile-drawer-search' : ''}`}
      ref={containerRef}
    >
      <div className="product-search-input-box">
        <span className="search-input-icon" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="search"
          className="product-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(-1)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-label="Search hardware products"
        />

        {query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Clear search query"
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="product-search-dropdown" role="listbox">
          {results.length > 0 ? (
            <>
              <div className="search-dropdown-header">
                <span>Matching Products ({totalMatches})</span>
                <span className="search-tip-hint">↑↓ to navigate • Enter to view</span>
              </div>

              <div className="search-results-list">
                {results.map((product, index) => {
                  const isSelected = index === selectedIndex
                  const thumb = product.images?.[0]
                  return (
                    <button
                      key={product.slug || product.id}
                      type="button"
                      className={`search-result-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectProduct(product)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="search-result-thumb-wrapper">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="search-result-thumb"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex'
                              }
                            }}
                          />
                        ) : null}
                        <span
                          className="search-result-thumb-fallback"
                          style={{ display: thumb ? 'none' : 'flex' }}
                          aria-hidden="true"
                        >
                          {product.categoryIcon || '💻'}
                        </span>
                      </div>

                      <div className="search-result-info">
                        <span className="search-result-name">{product.rawName || product.name}</span>
                        <div className="search-result-meta">
                          <span className="search-meta-cat">{product.categoryTitle}</span>
                          {product.brand && (
                            <span className="search-meta-brand">Brand: {product.brand}</span>
                          )}
                          {product.model && (
                            <span className="search-meta-model">{product.model}</span>
                          )}
                        </div>
                      </div>

                      <span className="search-result-arrow" aria-hidden="true">→</span>
                    </button>
                  )
                })}
              </div>

              {totalMatches > results.length && (
                <div className="search-dropdown-footer">
                  <button
                    type="button"
                    className={`search-view-all-btn ${selectedIndex === results.length ? 'selected' : ''}`}
                    onClick={handleViewAllResults}
                    onMouseEnter={() => setSelectedIndex(results.length)}
                  >
                    View all {totalMatches} results for "{query.trim()}" →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="search-no-results">
              <span className="no-results-icon" aria-hidden="true">🔍</span>
              <p className="no-results-title">No products found for "{query.trim()}"</p>
              <p className="no-results-sub">
                Try checking the spelling or searching by category, brand, or general keyword.
              </p>
              <div className="search-suggested-keywords">
                <span className="suggested-label">Try searching:</span>
                <div className="suggested-tags">
                  {['Laptops', 'CCTV', 'Laser Printer', 'Biometrics', 'Accessories'].map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="suggested-tag-btn"
                      onClick={() => {
                        setQuery(term)
                        setIsOpen(true)
                        inputRef.current?.focus()
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
