import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fetchPublicCatalog, getInstantCatalog } from '../lib/catalog'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import CustomerServiceRequestForm from '../components/CustomerServiceRequestForm'
import '../App.css'


const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Consultation & Site Review',
    desc: 'Share your hardware specs or request an on-site evaluation for CCTV surveillance or office network setups.'
  },
  {
    step: '02',
    title: 'Transparent Technical Proposal',
    desc: 'Receive an itemized quote with genuine component model numbers, manufacturer warranties, and turnkey labor pricing.'
  },
  {
    step: '03',
    title: 'Deployment & Ongoing AMC',
    desc: 'Timely on-site delivery, professional cabling, OS/software configuration, and dedicated post-setup maintenance support.'
  }
]

function CustomerHomePage() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [catalogCategories, setCatalogCategories] = useState(() => getInstantCatalog().categories || [])
  const [catalogError, setCatalogError] = useState(null)

  const [activeSection, setActiveSection] = useState('home')
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Service section mode tab ('offerings' | 'request')
  const [serviceTab, setServiceTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const params = new URLSearchParams(window.location.search)
      if (hash === '#service-request' || params.get('service') === 'request') {
        return 'request'
      }
    }
    return 'offerings'
  })
  const [serviceRequestCategory, setServiceRequestCategory] = useState('Desktop Computer')

  // Controlled form state (initialized with URL query params if present)
  const [formData, setFormData] = useState(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const catParam = params?.get('category')
    const prodParam = params?.get('product')
    return {
      name: '',
      contact_info: '',
      category_interest: catParam || 'general',
      message: prodParam ? `I would like to request an official quote for ${prodParam}.` : '',
      website_hp: ''
    }
  })

  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false,
    error: null
  })

  // Fetch active catalog from Supabase (with unconfigured demo fallback)
  useEffect(() => {
    let isMounted = true

    async function loadCatalog() {
      try {
        const result = await fetchPublicCatalog()
        if (isMounted) {
          if (result.categories && result.categories.length > 0) {
            setCatalogCategories(result.categories)
            setCatalogError(null)
          } else if (result.error || result.isEmpty) {
            setCatalogCategories([])
            setCatalogError(result.error)
          }
        }
      } catch (err) {
        console.warn('Catalog load error:', err)
        if (isMounted) {
          setCatalogCategories([])
          setCatalogError(err?.message || 'Unable to connect to the hardware catalog.')
        }
      }
    }

    loadCatalog()

    return () => {
      isMounted = false
    }
  }, [])

  // Track active section and scroll-to-top visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)

      const sections = ['home', 'about', 'products', 'services', 'process', 'contact']
      const scrollPos = window.scrollY + 160

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(sectionId)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle hash scrolling when arriving from subpages
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '')
      setTimeout(() => {
        if (id === 'service-request') {
          setServiceTab('request')
        }
        const targetId = id === 'service-request' ? 'services' : id
        const el = document.getElementById(targetId)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    }
  }, [])

  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Handle raising a specific after-sales service ticket
  const handleRaiseServiceCard = (catName) => {
    setServiceRequestCategory(catName)
    setServiceTab('request')
    scrollToSection('services')
  }

  // Handle direct navigation to service enquiry form from hero
  const handleServiceEnquiryHeroClick = () => {
    setServiceTab('request')
    setTimeout(() => {
      scrollToSection('services')
    }, 50)
  }

  // Handle direct inquiry click from category card or service card
  const handleInquireCategory = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      category_interest: categoryId || 'general'
    }))
    scrollToSection('contact')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()

    if (formStatus.loading) return // Prevent accidental duplicate submit

    // 1. Anti-spam honeypot detection: Silently discard automated bot submissions
    if (formData.website_hp) {
      setFormStatus({ loading: false, success: true, error: null })
      return
    }

    // 2. Client-side abuse throttling: 30-second cooldown per client session
    const lastSubmissionKey = 'ars_last_enquiry_submitted_at'
    const lastSubmitted = Number(sessionStorage.getItem(lastSubmissionKey) || 0)
    const cooldownMs = 30000
    if (Date.now() - lastSubmitted < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (Date.now() - lastSubmitted)) / 1000)
      setFormStatus({
        loading: false,
        success: false,
        error: `Please wait ${waitSeconds}s before submitting another enquiry.`
      })
      return
    }

    const name = formData.name.trim()
    const contactInfo = formData.contact_info.trim()
    const message = formData.message.trim()

    if (name.length < 2) {
      setFormStatus({ loading: false, success: false, error: 'Please enter a valid name (at least 2 characters).' })
      return
    }
    if (contactInfo.length < 5) {
      setFormStatus({ loading: false, success: false, error: 'Please enter a valid phone number or email (at least 5 characters).' })
      return
    }

    // Validate contact info format (either email or phone)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phonePattern = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/
    if (!emailPattern.test(contactInfo) && !phonePattern.test(contactInfo)) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'Please provide a valid email address (e.g. name@domain.com) or phone number (e.g. +91 9876543210).'
      })
      return
    }

    if (message.length < 5) {
      setFormStatus({ loading: false, success: false, error: 'Please provide brief details of your requirement (at least 5 characters).' })
      return
    }

    setFormStatus({ loading: true, success: false, error: null })

    try {
      if (isSupabaseConfigured && supabase) {
        // Direct public insert into enquiries table with 8-second timeout
        const submitPromise = supabase.from('enquiries').insert([
          {
            name,
            contact_info: contactInfo,
            category_interest: formData.category_interest,
            message,
            status: 'new'
          }
        ])

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Submission timed out')), 8000)
        )

        const { error: insertErr } = await Promise.race([submitPromise, timeoutPromise])

        if (insertErr) {
          throw insertErr
        }
      } else {
        // Graceful local handling when offline or unconfigured
        await new Promise(resolve => setTimeout(resolve, 400))
      }

      // Record successful submission timestamp for client throttling
      sessionStorage.setItem(lastSubmissionKey, String(Date.now()))

      setFormStatus({ loading: false, success: true, error: null })
      setFormData({
        name: '',
        contact_info: '',
        category_interest: 'general',
        message: '',
        website_hp: ''
      })
    } catch (err) {
      setFormStatus({
        loading: false,
        success: false,
        error: err?.message || 'Unable to submit your inquiry. Please try calling our desk directly.'
      })
    }
  }

  const filteredCategories = selectedCategory === 'all'
    ? catalogCategories
    : catalogCategories.filter(cat => cat.id === selectedCategory)

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <SiteHeader activeSection={activeSection} selectedCategory={selectedCategory} />

      {/* 1. HOME / HERO SECTION */}
      <section id="home" className="hero-section-outer">
        <div className="hero-section">
          <div className="hero-grid">
            <div className="hero-text-col">
              <div className="hero-pill">
                <span className="hero-pill-dot"></span>
                <span>Enterprise IT Hardware &amp; Smart Security</span>
              </div>
              <h1 className="hero-title">
                Powering Your Workplace<br />
                with<br />
                <span className="hero-title-blue">Reliable Tech &amp; Security</span><br />
                Solutions
              </h1>
              <p className="hero-desc">
                Authorized supplier &amp; system integrator for computing hardware, CCTV surveillance setups,
                office printers, and biometric attendance infrastructure.
              </p>
              <div className="hero-cta-group">
                <button className="hero-btn-primary" onClick={() => scrollToSection('products')}>
                  Explore Products &rarr;
                </button>
                <button className="hero-btn-secondary" onClick={handleServiceEnquiryHeroClick}>
                  Service Enquiry &rarr;
                </button>
              </div>
            </div>

            <div className="hero-visual-col">
              <div className="hero-showcase-card">
                <div className="hero-media-wrapper">
                  <img
                    src="/hero-storefront.jpg"
                    alt="ARS Computers Storefront &amp; Service Center in Rudrapur"
                    className="hero-hardware-img"
                    onError={(e) => { e.currentTarget.src = '/hero-hardware.jpg' }}
                  />
                </div>
                <div className="hero-showcase-badge">
                  <span className="badge-live-pulse"></span>
                  <span>Certified Integrator</span>
                </div>
                <div className="hero-showcase-tags">
                  <span className="showcase-tag">4K CCTV</span>
                  <span className="showcase-tag">Workstations</span>
                  <span className="showcase-tag">Laser Printers</span>
                  <span className="showcase-tag">Biometrics</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats / Trust Badges */}
          <div className="stats-banner">
            <div className="stat-item">
              <div className="stat-icon">💻</div>
              <div>
                <div className="stat-title">{catalogCategories.length} Core Categories</div>
                <div className="stat-desc">Complete IT hardware suite</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">🛡️</div>
              <div>
                <div className="stat-title">100% Genuine</div>
                <div className="stat-desc">Original manufacturer warranty</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">🔧</div>
              <div>
                <div className="stat-title">On-site Installation</div>
                <div className="stat-desc">Certified engineering support</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">⚡</div>
              <div>
                <div className="stat-title">Rapid Service</div>
                <div className="stat-desc">Quick turnaround &amp; AMC support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ABOUT SECTION */}
      <section id="about" className="about-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-tag">About ARS Computers</span>
            <h3 className="section-title">Your Trusted Technology Partner</h3>
            <p className="section-subtitle">
              Delivering dependable hardware, advanced surveillance systems, and robust office infrastructure solutions to businesses, schools, and homes.
            </p>
          </div>

          <div className="about-grid">
            <div className="about-card">
              <div className="about-icon">🏆</div>
              <h4>Authorized IT Dealer</h4>
              <p>We source authentic computing machines, components, and security systems directly from certified global brands.</p>
            </div>
            <div className="about-card">
              <div className="about-icon">🛠️</div>
              <h4>In-House Technical Lab</h4>
              <p>Certified engineers for diagnostics, custom desktop builds, high-precision chip-level repairs, and optical maintenance.</p>
            </div>
            <div className="about-card">
              <div className="about-icon">🤝</div>
              <h4>End-to-End AMC Support</h4>
              <p>Annual Maintenance Contracts for offices, schools, and commercial enterprises ensuring zero hardware downtime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCTS SECTION */}
      <section id="products" className="categories-section">
        <div className="section-header">
          <div>
            <span className="section-tag">Product Catalog</span>
            <h3 className="section-title">
              {selectedCategory === 'all'
                ? 'All Product Categories'
                : catalogCategories.find(c => c.id === selectedCategory)?.title}
            </h3>
          </div>

          <div className="category-filter-chips">
            <button
              className={`filter-chip ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Categories ({catalogCategories.length})
            </button>
            {catalogCategories.map((cat) => (
              <button
                key={cat.id}
                className={`filter-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.icon} {cat.title}
              </button>
            ))}
          </div>
        </div>

        {selectedCategory !== 'all' && (
          <div className="category-filter-notice">
            <span>Showing products in: <strong>{catalogCategories.find(c => c.id === selectedCategory)?.title}</strong></span>
            <button className="clear-filter-btn" onClick={() => setSelectedCategory('all')}>
              Show All Categories ✕
            </button>
          </div>
        )}

        <div className="categories-grid">
          {filteredCategories.length === 0 ? (
            <div className="category-empty-state">
              <p>{catalogError || 'No active hardware products currently listed under this category.'}</p>
              <button
                className="btn-primary"
                onClick={async () => {
                  setSelectedCategory('all')
                  const res = await fetchPublicCatalog({ forceRefresh: true })
                  if (res.categories && res.categories.length > 0) {
                    setCatalogCategories(res.categories)
                    setCatalogError(null)
                  }
                }}
              >
                {catalogError ? '↻ Try Again' : 'View All Categories'}
              </button>
            </div>
          ) : (
            filteredCategories.map((category) => (
              <article
                key={category.id}
                className="category-card"
                onClick={() => navigate(`/category/${category.slug || category.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/category/${category.slug || category.id}`)
                  }
                }}
              >
                <div className="card-top">
                  <div className="card-icon">{category.icon}</div>
                  <span className="card-badge">{category.badge}</span>
                </div>
                <h4 className="card-title">
                  <span className="card-title-link">
                    {category.title}
                  </span>
                </h4>
                <div className="card-tagline">{category.tagline}</div>

                {category.description && (
                  <p className="card-desc">{category.description}</p>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {/* 4. SERVICES SECTION */}
      <section id="services" className="services-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-tag">Professional Services &amp; Repairs</span>
            <h3 className="section-title">Installation, Maintenance &amp; After-Sales Support</h3>
            <p className="section-subtitle">
              Comprehensive hardware diagnostics, CCTV surveillance engineering, and technical repair services delivered by certified engineers with guaranteed workmanship.
            </p>

            {/* Service View Switcher Tabs */}
            <div className="service-mode-tabs" role="tablist" aria-label="Service Section View">
              <button
                type="button"
                role="tab"
                id="service-tab-offerings"
                aria-selected={serviceTab === 'offerings'}
                aria-controls="service-panel-offerings"
                className={`service-mode-tab-btn ${serviceTab === 'offerings' ? 'active' : ''}`}
                onClick={() => setServiceTab('offerings')}
              >
                <span>⚙️ Service Capabilities &amp; AMC</span>
              </button>
              <button
                type="button"
                role="tab"
                id="service-tab-request"
                aria-selected={serviceTab === 'request'}
                aria-controls="service-panel-request"
                className={`service-mode-tab-btn ${serviceTab === 'request' ? 'active' : ''}`}
                onClick={() => setServiceTab('request')}
              >
                <span>🛠️ Raise a Service / Repair Request</span>
                <span className="service-tab-badge">Instant Ticket</span>
              </button>
            </div>
          </div>

          {serviceTab === 'offerings' ? (
            <div id="service-panel-offerings" role="tabpanel" aria-labelledby="service-tab-offerings">
              <div className="services-grid">
                <div className="service-card">
                  <div className="service-icon">💻</div>
                  <h4>Custom PC Assembly &amp; Upgrades</h4>
                  <p>Tailored workstations and gaming rigs configured to your performance requirements. SSD, RAM, GPU, and cooling upgrades.</p>
                  <ul className="service-features">
                    <li>✓ Stress-tested thermal stability</li>
                    <li>✓ Clean cable management</li>
                    <li>✓ OS &amp; driver pre-configuration</li>
                  </ul>
                  <div className="service-card-actions">
                    <button
                      type="button"
                      className="btn-primary service-action-btn"
                      onClick={() => handleRaiseServiceCard('Desktop Computer')}
                    >
                      🛠️ Raise PC / Laptop Ticket
                    </button>
                    <button
                      type="button"
                      className="btn-outline service-cta-btn"
                      onClick={() => handleInquireCategory('service')}
                    >
                      General Enquiry →
                    </button>
                  </div>
                </div>

                <div className="service-card">
                  <div className="service-icon">📹</div>
                  <h4>CCTV Surveillance Setup &amp; AMC</h4>
                  <p>Turnkey security camera installations, NVR cabling, IP network configurations, and remote smartphone monitoring setup.</p>
                  <ul className="service-features">
                    <li>✓ Site survey &amp; blind-spot analysis</li>
                    <li>✓ Weatherproof outdoor conduit piping</li>
                    <li>✓ Mobile app remote streaming setup</li>
                  </ul>
                  <div className="service-card-actions">
                    <button
                      type="button"
                      className="btn-primary service-action-btn"
                      onClick={() => handleRaiseServiceCard('CCTV Camera')}
                    >
                      🛠️ Raise CCTV Service Ticket
                    </button>
                    <button
                      type="button"
                      className="btn-outline service-cta-btn"
                      onClick={() => handleInquireCategory('cctv')}
                    >
                      General Enquiry →
                    </button>
                  </div>
                </div>

                <div className="service-card">
                  <div className="service-icon">🛡️</div>
                  <h4>Biometric Machine &amp; Access Control</h4>
                  <p>Attendance machine mounting, network integration, user enrollment, and seamless payroll/HR software synchronization.</p>
                  <ul className="service-features">
                    <li>✓ Facial &amp; fingerprint calibration</li>
                    <li>✓ Automated daily attendance logs</li>
                    <li>✓ Magnetic door lock integration</li>
                  </ul>
                  <div className="service-card-actions">
                    <button
                      type="button"
                      className="btn-primary service-action-btn"
                      onClick={() => handleRaiseServiceCard('Biometric / Access Control')}
                    >
                      🛠️ Raise Biometric Ticket
                    </button>
                    <button
                      type="button"
                      className="btn-outline service-cta-btn"
                      onClick={() => handleInquireCategory('biometric-machine')}
                    >
                      General Enquiry →
                    </button>
                  </div>
                </div>

                <div className="service-card">
                  <div className="service-icon">🖨️</div>
                  <h4>Printer Care, Refills &amp; Servicing</h4>
                  <p>Precision laser printer repair, paper jam resolution, printhead unclogging, and genuine cartridge refilling services.</p>
                  <ul className="service-features">
                    <li>✓ High-density smudge-free toner</li>
                    <li>✓ Roller &amp; fuser replacement</li>
                    <li>✓ Preventive maintenance visits</li>
                  </ul>
                  <div className="service-card-actions">
                    <button
                      type="button"
                      className="btn-primary service-action-btn"
                      onClick={() => handleRaiseServiceCard('Printer / Peripheral')}
                    >
                      🛠️ Raise Printer Ticket
                    </button>
                    <button
                      type="button"
                      className="btn-outline service-cta-btn"
                      onClick={() => handleInquireCategory('printer')}
                    >
                      General Enquiry →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div id="service-panel-request" role="tabpanel" aria-labelledby="service-tab-request">
              <CustomerServiceRequestForm
                initialCategory={serviceRequestCategory}
                onCancel={() => setServiceTab('offerings')}
              />
            </div>
          )}
        </div>
      </section>

      {/* PROCESS SECTION: How It Works */}
      <section id="process" className="process-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-tag">How We Work</span>
            <h3 className="section-title">Seamless Procurement &amp; Support</h3>
            <p className="section-subtitle">
              From initial consultation to deployment and maintenance, we ensure transparent pricing and reliable delivery.
            </p>
          </div>

          <div className="process-grid">
            {PROCESS_STEPS.map((step, idx) => (
              <div key={idx} className="process-card">
                <div className="process-step-badge">{step.step}</div>
                <h4 className="process-card-title">{step.title}</h4>
                <p className="process-card-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 5. CONTACT SECTION */}
      <section id="contact" className="contact-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-tag">Get in Touch</span>
            <h3 className="section-title">Contact ARS Computers</h3>
            <p className="section-subtitle">
              Have a product inquiry or need a custom quote? Reach out to our technical team today.
            </p>
          </div>

          <div className="contact-grid">
            {/* Left: Office Location / Google Map Card */}
            <div className="contact-map-card">
              <div className="map-card-header">
                <div>
                  <h4>Our Location</h4>
                  <p className="map-card-sub">
                    Near Hanuman Mandir, Shri Ram Market, Sidcul, Rudrapur, Uttarakhand - 263153
                  </p>
                </div>
                <a
                  href="https://www.google.com/maps/place/ARS+COMPUTER/@28.9886355,79.4157898,17z/data=!3m1!4b1!4m6!3m5!1s0x39a07f6e3ce61363:0x720fff903c2251ee!8m2!3d28.9886308!4d79.4183647!16s%2Fg%2F11yrj3xb4h"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="map-directions-link"
                  title="Open ARS Computers in Google Maps"
                >
                  Get Directions &rarr;
                </a>
              </div>

              <div className="map-embed-wrapper">
                <iframe
                  title="ARS Computers Showroom &amp; Service Center Location in Rudrapur"
                  src="https://maps.google.com/maps?q=28.9886308,79.4183647&amp;hl=en&amp;z=17&amp;output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>

              <div className="map-card-footer">
                <div className="map-contact-chips">
                  <span className="map-landmark-pill">📍 Near Hanuman Mandir</span>
                  <a href="tel:+917078382213" className="map-phone-pill">📞 +91 7078382213</a>
                </div>
                <a
                  href="https://www.google.com/maps/place/ARS+COMPUTER/@28.9886355,79.4157898,17z/data=!3m1!4b1!4m6!3m5!1s0x39a07f6e3ce61363:0x720fff903c2251ee!8m2!3d28.9886308!4d79.4183647!16s%2Fg%2F11yrj3xb4h"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="map-view-large-btn"
                >
                  Open in Google Maps ↗
                </a>
              </div>
            </div>

            <div className="contact-form-card">
              <h4>Send Us an Inquiry</h4>

              {formStatus.success ? (
                <div className="form-success-banner">
                  <span className="success-icon">✓</span>
                  <strong>Thank You!</strong>
                  <p>Your inquiry has been received. Our team will contact you shortly.</p>
                  <button
                    className="btn-outline clear-filter-btn"
                    style={{ marginTop: '16px' }}
                    onClick={() => setFormStatus({ loading: false, success: false, error: null })}
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form className="contact-form" onSubmit={handleContactSubmit}>
                  {/* Anti-spam honeypot field - hidden from legitimate human visitors */}
                  <div style={{ display: 'none', position: 'absolute', left: '-9999px' }} aria-hidden="true">
                    <label htmlFor="website_hp">Do not fill this field</label>
                    <input
                      id="website_hp"
                      name="website_hp"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.website_hp || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  {formStatus.error && (
                    <div className="form-error-banner">
                      <span>⚠️ {formStatus.error}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="name">Your Name *</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact_info">Phone Number / Email *</label>
                    <input
                      id="contact_info"
                      name="contact_info"
                      type="text"
                      required
                      placeholder="e.g. +91 9876543210 or john@example.com"
                      value={formData.contact_info}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="category_interest">Product or Service Interest</label>
                    <select
                      id="category_interest"
                      name="category_interest"
                      value={formData.category_interest}
                      onChange={handleInputChange}
                    >
                      <option value="general">General IT Inquiry</option>
                      <option value="computer-laptop">Computer / Laptop</option>
                      <option value="cctv">CCTV &amp; Security</option>
                      <option value="printer">Printer &amp; Scanners</option>
                      <option value="biometric-machine">Biometric Machine</option>
                      <option value="accessories">Computer Accessories</option>
                      <option value="service">On-site Service / AMC</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="message">Message / Requirements *</label>
                    <textarea
                      id="message"
                      name="message"
                      rows="3"
                      placeholder="Tell us about the products, quantities, or services you require..."
                      required
                      value={formData.message}
                      onChange={handleInputChange}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={formStatus.loading}
                  >
                    {formStatus.loading ? 'Submitting Inquiry...' : 'Submit Inquiry'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          className="back-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll back to top"
        >
          ↑
        </button>
      )}

      {/* Site Footer */}
      <SiteFooter />
    </div>
  )
}

export default CustomerHomePage
