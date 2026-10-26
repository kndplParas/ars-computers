import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom'
import CustomerHomePage from './pages/CustomerHomePage'
import { AdminAuthProvider } from './context/AdminAuthProvider'
import { AdminDataProvider } from './context/AdminDataProvider'
import AdminRouteGuard from './components/admin/AdminRouteGuard'
import ErrorBoundary from './components/common/ErrorBoundary'

// Lazy-load non-index routes for code splitting and instant initial page load
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'))
const AdminInventoryPage = lazy(() => import('./pages/admin/AdminInventoryPage'))
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'))
const AdminEnquiriesPage = lazy(() => import('./pages/admin/AdminEnquiriesPage'))
const AdminStaffPage = lazy(() => import('./pages/admin/AdminStaffPage'))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Lightweight page transition shell that preserves page layout and prevents shifts
function RouteTransitionShell() {
  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="site-header" style={{ height: '76px' }}></header>
      <div style={{ flex: 1, padding: '60px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div className="skeleton-line" style={{ width: '160px', height: '14px', marginBottom: '24px' }}></div>
        <div className="skeleton-line" style={{ width: '320px', height: '36px', marginBottom: '16px' }}></div>
        <div className="skeleton-line" style={{ width: '480px', height: '18px', marginBottom: '40px' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="category-product-card skeleton-card" style={{ height: '320px' }}>
              <div className="skeleton-card-visual skeleton-shimmer" style={{ height: '160px' }}></div>
              <div className="skeleton-card-body" style={{ padding: '16px' }}>
                <div className="skeleton-line" style={{ width: '70%', height: '18px', marginBottom: '10px' }}></div>
                <div className="skeleton-line" style={{ width: '90%', height: '14px', marginBottom: '16px' }}></div>
                <div className="skeleton-line" style={{ width: '100%', height: '38px' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryRouteWrapper() {
  const { slug } = useParams()
  return <CategoryPage key={slug} />
}

function ProductRouteWrapper() {
  const { slug } = useParams()
  return <ProductDetailsPage key={slug} />
}

function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AdminDataProvider>
          <ErrorBoundary>
            <Suspense fallback={<RouteTransitionShell />}>
              <Routes>
                {/* Customer Facing Website */}
                <Route path="/" element={<CustomerHomePage />} />
                <Route path="/category/:slug" element={<CategoryRouteWrapper />} />
                <Route path="/products/:slug" element={<ProductRouteWrapper />} />
                <Route path="/search" element={<SearchResultsPage />} />

                {/* Admin Authentication & Console Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route
                  path="/admin"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin', 'admin', 'inventory_staff']}>
                      <AdminDashboardPage />
                    </AdminRouteGuard>
                  }
                />
                <Route
                  path="/admin/products"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin', 'admin']}>
                      <AdminProductsPage />
                    </AdminRouteGuard>
                  }
                />
                <Route
                  path="/admin/inventory"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin', 'admin', 'inventory_staff']}>
                      <AdminInventoryPage />
                    </AdminRouteGuard>
                  }
                />
                <Route
                  path="/admin/categories"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin', 'admin']}>
                      <AdminCategoriesPage />
                    </AdminRouteGuard>
                  }
                />
                <Route
                  path="/admin/enquiries"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin', 'admin']}>
                      <AdminEnquiriesPage />
                    </AdminRouteGuard>
                  }
                />
                <Route
                  path="/admin/service-requests"
                  element={<Navigate to="/admin/enquiries" replace />}
                />
                <Route
                  path="/admin/staff"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin']}>
                      <AdminStaffPage />
                    </AdminRouteGuard>
                  }
                />
                <Route
                  path="/admin/dashboard"
                  element={
                    <AdminRouteGuard allowedRoles={['superadmin', 'admin', 'inventory_staff']}>
                      <Navigate to="/admin" replace />
                    </AdminRouteGuard>
                  }
                />

                {/* 404 Fallback Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AdminDataProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  )
}

export default App
