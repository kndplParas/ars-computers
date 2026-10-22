import { supabase, isSupabaseConfigured } from './supabase.js'
import { CATEGORIES } from '../data/categories.js'
import { PRODUCT_IMAGES } from '../data/productImages.js'

/**
 * Strictly approved public product columns for customer catalog browsing.
 * CRITICAL SECURITY INVARIANT:
 * `cost_price` is EXCLUDED. Only public customer-safe attributes are requested.
 */
export const APPROVED_PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'category_id',
  'name',
  'slug',
  'sku',
  'brand',
  'model',
  'spec_summary',
  'spec_attributes',
  'price',
  'stock_quantity',
  'min_stock_alert',
  'is_featured',
  'is_active',
  'images',
  'is_generic',
  'warranty_text',
  'hsn_code',
  'availability_status',
  'created_at',
  'updated_at'
].join(', ')

export const APPROVED_PUBLIC_PRODUCT_BASE_COLUMNS = [
  'id',
  'category_id',
  'name',
  'slug',
  'sku',
  'brand',
  'model',
  'spec_summary',
  'spec_attributes',
  'price',
  'stock_quantity',
  'min_stock_alert',
  'is_featured',
  'is_active',
  'images',
  'created_at',
  'updated_at'
].join(', ')

/**
 * Approved public category columns for customer navigation and filtering.
 */
export const APPROVED_PUBLIC_CATEGORY_COLUMNS = [
  'id',
  'slug',
  'title',
  'short_title',
  'tagline',
  'description',
  'icon',
  'badge',
  'display_order',
  'is_active',
  'created_at',
  'updated_at'
].join(', ')

// In-memory cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const REQUEST_TIMEOUT_MS = 10000 // 10 seconds network timeout to ensure reliable database responses

let cachedCatalog = null
let cacheTimestamp = 0
let inFlightPromise = null

/**
 * Normalizes static fallback categories to have consistent product attributes.
 */
export function normalizeStaticCategories(categories) {
  return categories.map((cat) => {
    const catSlug = cat.slug || cat.id
    return {
      id: catSlug,
      slug: catSlug,
      dbId: cat.id,
      title: cat.title,
      shortTitle: cat.shortTitle || cat.short_title || cat.title,
      tagline: cat.tagline || '',
      description: cat.description || '',
      icon: cat.icon || '💻',
      badge: cat.badge || 'Popular',
      products: (cat.products || []).map((p) => ({
        id: p.slug,
        name: p.name,
        rawName: p.name,
        spec: p.spec,
        specSummary: p.spec,
        description: p.description || '',
        specAttributes: p.specAttributes || {},
        brand: p.brand || null,
        model: p.model || null,
        sku: p.sku || null,
        price: p.price ?? null,
        stock: p.stock ?? 0,
        isFeatured: p.isFeatured || false,
        isGeneric: p.isGeneric ?? true,
        warrantyText: p.warrantyText || null,
        hsnCode: p.hsnCode || null,
        availabilityStatus: p.availabilityStatus || 'on_demand',
        slug: p.slug,
        categoryId: catSlug,
        categoryTitle: cat.title,
        categoryIcon: cat.icon || '💻',
        images: Array.isArray(p.images) && p.images.length > 0 ? p.images : []
      }))
    }
  })
}

/**
 * Normalizes user-supplied or URL category slugs and resolves common aliases.
 * E.g., 'CCTV' -> 'cctv', 'computer' -> 'computer-laptop', 'biometric machine' -> 'biometric-machine'
 */
export function normalizeCategorySlug(rawSlug) {
  if (!rawSlug) return ''
  const decoded = decodeURIComponent(String(rawSlug)).toLowerCase().trim()
  const cleaned = decoded.replace(/[\s_]+/g, '-')

  const aliasMap = {
    'computer': 'computer-laptop',
    'computers': 'computer-laptop',
    'laptop': 'computer-laptop',
    'laptops': 'computer-laptop',
    'pc': 'computer-laptop',
    'pcs': 'computer-laptop',
    'desktop': 'computer-laptop',
    'desktops': 'computer-laptop',
    'cctv': 'cctv',
    'camera': 'cctv',
    'cameras': 'cctv',
    'security': 'cctv',
    'surveillance': 'cctv',
    'printer': 'printer',
    'printers': 'printer',
    'printing': 'printer',
    'copier': 'printer',
    'copiers': 'printer',
    'biometric': 'biometric-machine',
    'biometrics': 'biometric-machine',
    'biometric-machine': 'biometric-machine',
    'attendance': 'biometric-machine',
    'accessories': 'accessories',
    'accessory': 'accessories'
  }

  return aliasMap[cleaned] || cleaned
}

/**
 * Helper to race any promise against a timeout to prevent infinite hanging states.
 */
function withTimeout(promise, timeoutMs, timeoutMsg = 'Operation timed out') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg))
    }, timeoutMs)

    promise
      .then((res) => {
        clearTimeout(timer)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/**
 * Synchronous instant catalog getter.
 * Returns in-memory cached catalog if available.
 * When Supabase is configured, returns an empty pending state to preserve the initial
 * loading experience (skeletons/spinners) and prevent demo data from flashing as live data.
 * When Supabase is unconfigured, returns the static demo catalog immediately.
 */
export function getInstantCatalog() {
  if (cachedCatalog && cachedCatalog.categories?.length > 0) {
    return cachedCatalog
  }

  // When Supabase is configured, return an empty pending state to preserve the initial
  // loading experience (skeletons/spinners) and prevent static demo data from flashing or replacing live data.
  if (isSupabaseConfigured && supabase) {
    return {
      categories: [],
      isLive: false,
      isEmpty: true,
      source: 'live_pending',
      error: null
    }
  }

  // Only when Supabase is completely unconfigured (offline demo mode), provide static fallback
  return {
    categories: normalizeStaticCategories(CATEGORIES),
    isLive: false,
    isEmpty: false,
    source: 'fallback_unconfigured',
    error: null
  }
}

/**
 * Synchronous instant category getter for initial component rendering.
 * Eliminates blank screens and blocking spinners on category navigation.
 */
export function getInstantCategoryBySlug(rawSlug) {
  const normalized = normalizeCategorySlug(rawSlug)
  const catalog = getInstantCatalog()

  if (!catalog || catalog.isEmpty || !catalog.categories || catalog.categories.length === 0) {
    return null
  }

  const category = (catalog.categories || []).find(
    (c) =>
      c.slug === normalized ||
      c.id === normalized ||
      c.slug.toLowerCase() === normalized.toLowerCase() ||
      c.title.toLowerCase().replace(/[^a-z0-9]/g, '-') === normalized
  )

  if (category) {
    return {
      category,
      products: category.products || []
    }
  }

  return null
}

/**
 * Synchronous instant product getter for initial component rendering.
 */
export function getInstantProductBySlug(productSlug) {
  if (!productSlug) return null
  const catalog = getInstantCatalog()

  if (!catalog || catalog.isEmpty || !catalog.categories || catalog.categories.length === 0) {
    return null
  }

  for (const cat of catalog.categories || []) {
    const found = (cat.products || []).find((p) => p.slug === productSlug)
    if (found) {
      return {
        product: {
          ...found,
          categoryId: cat.slug || cat.id,
          categoryTitle: cat.title,
          categoryIcon: cat.icon
        },
        category: cat
      }
    }
  }

  return null
}

/**
 * Manually invalidates in-memory catalog cache (useful after admin product updates).
 */
export function invalidateCatalogCache() {
  cachedCatalog = null
  cacheTimestamp = 0
  inFlightPromise = null
}

/**
 * Fetches the active public catalog from Supabase with in-memory caching,
 * request deduplication, and a strict 3.5s timeout fallback.
 *
 * @param {Object} options
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<{
 *   categories: Array,
 *   isLive: boolean,
 *   isEmpty: boolean,
 *   source: string,
 *   error: string | null
 * }>}
 */
export async function fetchPublicCatalog({ forceRefresh = false } = {}) {
  const now = Date.now()

  // 1. Return fresh in-memory cache if available
  if (!forceRefresh && cachedCatalog && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCatalog
  }

  // 2. Deduplicate in-flight requests across concurrent callers
  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise
  }

  // 3. Fallback when Supabase is not configured
  if (!isSupabaseConfigured || !supabase) {
    const result = {
      categories: normalizeStaticCategories(CATEGORIES),
      isLive: false,
      isEmpty: false,
      source: 'fallback_unconfigured',
      error: null
    }
    cachedCatalog = result
    cacheTimestamp = now
    return result
  }

  inFlightPromise = (async () => {
    try {
      // Execute categories and products fetch with timeout to prevent hanging
      const fetchOperation = async () => {
        // 1. Fetch active categories
        const { data: dbCategories, error: catError } = await supabase
          .from('categories')
          .select(APPROVED_PUBLIC_CATEGORY_COLUMNS)
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (catError) {
          throw catError
        }

        if (!dbCategories || dbCategories.length === 0) {
          return {
            categories: [],
            isLive: true,
            isEmpty: true,
            source: 'database_empty',
            error: null
          }
        }

        // 2. Fetch active products with strictly approved public columns (NO cost_price)
        let dbProducts = null
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select(APPROVED_PUBLIC_PRODUCT_COLUMNS)
          .eq('is_active', true)
          .order('is_featured', { ascending: false })
          .limit(10000)

        if (prodError) {
          // If extended columns do not exist yet in DB, fall back to base columns
          const { data: baseData, error: baseError } = await supabase
            .from('products')
            .select(APPROVED_PUBLIC_PRODUCT_BASE_COLUMNS)
            .eq('is_active', true)
            .order('is_featured', { ascending: false })
            .limit(10000)

          if (baseError) {
            throw baseError
          }
          dbProducts = baseData
        } else {
          dbProducts = prodData
        }

        // 3. Map DB records to UI-compatible category and product structure
        const mergedCategories = dbCategories.map((cat) => {
          const categoryProducts = (dbProducts || []).filter(
            (prod) => prod.category_id === cat.id || prod.category_id === cat.slug
          )

          const staticCat = CATEGORIES.find(
            (c) => c.id === cat.slug || c.title.toLowerCase() === cat.title.toLowerCase()
          )

          const categorySlug = cat.slug || cat.id

          const dbProductsList = categoryProducts.map((p) => {
            const productImages = Array.isArray(p.images) && p.images.length > 0
              ? p.images
              : (PRODUCT_IMAGES[p.slug] || [])
            const productDesc = p.description || ''

            return {
              id: p.id,
              name: p.brand ? `${p.name} (${p.brand})` : p.name,
              rawName: p.name,
              spec: p.spec_summary || (p.model ? `Model: ${p.model}` : 'Genuine Hardware with Warranty'),
              specSummary: p.spec_summary || null,
              description: productDesc,
              specAttributes: p.spec_attributes || {},
              brand: p.brand || null,
              model: p.model || null,
              sku: p.sku || null,
              price: p.price,
              stock: p.stock_quantity,
              isFeatured: p.is_featured,
              isGeneric: p.is_generic !== undefined ? Boolean(p.is_generic) : (!p.sku || !p.brand),
              warrantyText: p.warranty_text || null,
              hsnCode: p.hsn_code || null,
              availabilityStatus: p.availability_status || (typeof p.stock_quantity === 'number' && p.stock_quantity > 0 ? 'in_stock' : 'on_demand'),
              slug: p.slug,
              categoryId: categorySlug,
              categoryTitle: cat.title,
              categoryIcon: cat.icon || (staticCat?.icon || '💻'),
              images: productImages
            }
          })

          // CRITICAL PRODUCTION INVARIANT:
          // Strictly present live database products only.
          // Do not fabricate or inject static demo products, invented prices, stock, or brands.
          const productsList = dbProductsList

          return {
            id: categorySlug,
            slug: categorySlug,
            dbId: cat.id,
            title: cat.title,
            shortTitle: cat.short_title || cat.title,
            tagline: cat.tagline || (staticCat?.tagline || ''),
            description: cat.description || (staticCat?.description || ''),
            icon: cat.icon || (staticCat?.icon || '💻'),
            badge: cat.badge || (staticCat?.badge || 'Popular'),
            products: productsList
          }
        })

        return {
          categories: mergedCategories,
          isLive: true,
          isEmpty: false,
          source: 'supabase',
          error: null
        }
      }

      const result = await withTimeout(
        fetchOperation(),
        REQUEST_TIMEOUT_MS,
        'Supabase catalog request exceeded timeout limit'
      )

      cachedCatalog = result
      cacheTimestamp = Date.now()
      return result
    } catch (err) {
      console.warn('Catalog fetch notice:', err?.message || err)
      const isTimeout = Boolean(err?.message?.includes('timeout'))

      // If Supabase is configured: preserve any cached live products rather than
      // replacing them with static demo data
      if (isSupabaseConfigured && supabase) {
        if (cachedCatalog && cachedCatalog.isLive && cachedCatalog.categories?.length > 0) {
          return cachedCatalog
        }
        return {
          categories: [],
          isLive: false,
          isEmpty: true,
          source: isTimeout ? 'timeout' : 'error',
          error: err?.message || 'Unable to connect to the hardware catalog.'
        }
      }

      // Offline unconfigured fallback only
      const fallbackResult = {
        categories: normalizeStaticCategories(CATEGORIES),
        isLive: false,
        isEmpty: false,
        source: 'fallback_unconfigured',
        error: null
      }
      cachedCatalog = fallbackResult
      cacheTimestamp = Date.now()
      return fallbackResult
    } finally {
      inFlightPromise = null
    }
  })()

  return inFlightPromise
}

/**
 * Fetches a single category and its products by category slug (supports aliases).
 */
export async function fetchCategoryBySlug(rawSlug, options = {}) {
  const normalized = normalizeCategorySlug(rawSlug)
  const catalog = await fetchPublicCatalog(options)

  const category = (catalog.categories || []).find(
    (c) =>
      c.slug === normalized ||
      c.id === normalized ||
      c.slug.toLowerCase() === normalized.toLowerCase() ||
      c.title.toLowerCase().replace(/[^a-z0-9]/g, '-') === normalized
  )

  if (!category) {
    return {
      category: null,
      products: [],
      isLive: catalog.isLive,
      source: catalog.source,
      error: catalog.error || `Category "${rawSlug}" was not found.`
    }
  }

  return {
    category,
    products: category.products || [],
    isLive: catalog.isLive,
    source: catalog.source,
    error: null
  }
}

/**
 * Fetches a single product and its parent category by product slug.
 */
export async function fetchProductBySlug(productSlug, options = {}) {
  const catalog = await fetchPublicCatalog(options)

  for (const cat of catalog.categories || []) {
    const found = (cat.products || []).find((p) => p.slug === productSlug)
    if (found) {
      return {
        product: {
          ...found,
          categoryId: cat.slug || cat.id,
          categoryTitle: cat.title,
          categoryIcon: cat.icon
        },
        category: cat,
        isLive: catalog.isLive,
        source: catalog.source,
        error: null
      }
    }
  }

  return {
    product: null,
    category: null,
    isLive: catalog.isLive,
    source: catalog.source,
    error: catalog.error || `Product "${productSlug}" was not found.`
  }
}

/**
 * Fetches categories from Supabase using strictly approved columns.
 * Stable ordering: display_order ASC, title ASC.
 */
export async function fetchAdminCategories() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      categories: [],
      isLive: false,
      error: 'Supabase is not configured or offline.'
    }
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select(APPROVED_PUBLIC_CATEGORY_COLUMNS)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('title', { ascending: true })

    if (error) {
      return {
        categories: [],
        isLive: true,
        error: error.message
      }
    }

    return {
      categories: data || [],
      isLive: true,
      error: null
    }
  } catch (err) {
    return {
      categories: [],
      isLive: false,
      error: err.message || 'Unexpected error fetching categories.'
    }
  }
}

/**
 * Validates whether a given string is a valid UUID format.
 */
export function isValidUUID(str) {
  if (typeof str !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim())
}

/**
 * Fetches the administrative product catalog including cost_price via the secure RPC.
 * Strictly uses the four-argument signature:
 * (p_category_id, p_include_inactive, p_limit, p_offset).
 * Enforces safe bounded pagination (1..200).
 */
export async function fetchAdminProducts({
  categoryId = null,
  includeInactive = true,
  limit = 50,
  offset = 0,
  categories = []
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      products: [],
      isLive: false,
      error: 'Supabase is not configured or offline.',
      isPermissionDenied: false
    }
  }

  // Safe bounded pagination (1..200 limit, non-negative offset)
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const safeOffset = Math.max(Number(offset) || 0, 0)

  // Resolve category UUID if slug or ID was passed
  let safeCategoryId = null
  if (categoryId && categoryId !== 'all') {
    if (isValidUUID(categoryId)) {
      safeCategoryId = categoryId
    } else if (Array.isArray(categories) && categories.length > 0) {
      const matched = categories.find((c) => c.slug === categoryId || c.id === categoryId)
      if (matched && isValidUUID(matched.id)) {
        safeCategoryId = matched.id
      } else {
        // Requested category slug was not found in known categories
        safeCategoryId = '00000000-0000-0000-0000-000000000000'
      }
    } else {
      // Requested category is not a valid UUID and categories map is unavailable
      safeCategoryId = '00000000-0000-0000-0000-000000000000'
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_products', {
      p_category_id: safeCategoryId,
      p_include_inactive: Boolean(includeInactive),
      p_limit: safeLimit,
      p_offset: safeOffset
    })

    if (error) {
      const isPermissionDenied =
        error.code === '42501' ||
        error.message?.toLowerCase().includes('permission') ||
        error.message?.toLowerCase().includes('access denied') ||
        error.message?.toLowerCase().includes('insufficient_privilege')

      return {
        products: [],
        isLive: true,
        error: error.message,
        isPermissionDenied
      }
    }

    return {
      products: data || [],
      isLive: true,
      error: null,
      isPermissionDenied: false
    }
  } catch (err) {
    return {
      products: [],
      isLive: false,
      error: err.message || 'Unexpected error fetching admin products.',
      isPermissionDenied: false
    }
  }
}

/**
 * Searches the active customer product catalogue using in-memory ranking.
 * Strictly searches customer-visible active products using approved public fields:
 * name, brand, model, categoryTitle, categoryId, specSummary, description, specAttributes.
 *
 * Scoring / Priority:
 * 1. Exact name or model match (100)
 * 2. Name or model starts with query (85)
 * 3. Any word in name starts with query (75) (e.g. "laser" -> "LaserJet")
 * 4. Name contains query (60)
 * 5. Brand or model contains query (50) (e.g. "hp", "dahua", "canon")
 * 6. Category title or slug matches query (35) (e.g. "printer", "cctv", "laptop", "biometric")
 * 7. Description, specSummary or specifications match query (20)
 *
 * @param {string} query Search input string
 * @param {Object|Array|null} [catalogSource=null] Optional pre-loaded catalog or categories array
 * @param {Object} [options={}]
 * @param {number} [options.limit=8] Maximum matches to return in primary `results`
 * @returns {{
 *   results: Array,
 *   allResults: Array,
 *   totalMatches: number,
 *   query: string
 * }}
 */
export function searchActiveCatalog(query, catalogSource = null, { limit = 8 } = {}) {
  if (!query || typeof query !== 'string') {
    return { results: [], allResults: [], totalMatches: 0, query: '' }
  }

  const q = query.trim().toLowerCase()
  if (!q) {
    return { results: [], allResults: [], totalMatches: 0, query: '' }
  }

  // 1. Resolve categories list from source or instant cache
  let categories = []
  if (catalogSource) {
    if (Array.isArray(catalogSource)) {
      categories = catalogSource
    } else if (Array.isArray(catalogSource.categories)) {
      categories = catalogSource.categories
    }
  } else {
    const instant = getInstantCatalog()
    categories = instant?.categories || []
  }

  // 2. Extract deduplicated active products
  const productMap = new Map()
  for (const cat of categories) {
    const catSlug = cat.slug || cat.id || ''
    const catTitle = cat.title || ''
    const catIcon = cat.icon || '💻'

    for (const prod of (cat.products || [])) {
      if (prod && prod.slug && !productMap.has(prod.slug)) {
        productMap.set(prod.slug, {
          ...prod,
          categoryId: prod.categoryId || catSlug,
          categoryTitle: prod.categoryTitle || catTitle,
          categoryIcon: prod.categoryIcon || catIcon
        })
      }
    }
  }

  const allProducts = Array.from(productMap.values())

  // 3. Match and calculate scores
  const matched = []

  for (const p of allProducts) {
    const name = (p.rawName || p.name || '').toLowerCase()
    const brand = (p.brand || '').toLowerCase()
    const model = (p.model || '').toLowerCase()
    const catTitle = (p.categoryTitle || '').toLowerCase()
    const catSlug = (p.categoryId || '').toLowerCase()
    const specSummary = (p.specSummary || p.spec || '').toLowerCase()
    const desc = (p.description || '').toLowerCase()
    const specsStr = p.specAttributes && typeof p.specAttributes === 'object'
      ? Object.values(p.specAttributes).map(v => String(v).toLowerCase()).join(' ')
      : ''

    let score = 0
    let matchedField = null

    // Priority 1: Exact product name or model match
    if (name === q || model === q) {
      score = 100
      matchedField = 'exact'
    }
    // Priority 2: Product name or model starts with query
    else if (name.startsWith(q) || model.startsWith(q)) {
      score = 85
      matchedField = 'prefix'
    }
    // Priority 2b: Any word in product name starts with query
    else if (name.split(/[\s\-_/]+/).some(w => w.startsWith(q))) {
      score = 75
      matchedField = 'word_prefix'
    }
    // Priority 3: Product name contains query
    else if (name.includes(q)) {
      score = 60
      matchedField = 'name'
    }
    // Priority 4: Brand or model contains query
    else if (brand.includes(q) || model.includes(q)) {
      score = 50
      matchedField = 'brand_model'
    }
    // Priority 5: Category match
    else if (catTitle.includes(q) || catSlug.includes(q) || q.includes(catSlug)) {
      score = 35
      matchedField = 'category'
    }
    // Priority 6: Description or specification match
    else if (specSummary.includes(q) || desc.includes(q) || specsStr.includes(q)) {
      score = 20
      matchedField = 'specs'
    }

    if (score > 0) {
      matched.push({
        ...p,
        searchScore: score,
        matchedField
      })
    }
  }

  // 4. Sort by score DESC, featured DESC, shorter name ASC, alphabetical ASC
  matched.sort((a, b) => {
    if (b.searchScore !== a.searchScore) {
      return b.searchScore - a.searchScore
    }
    if (Boolean(b.isFeatured) !== Boolean(a.isFeatured)) {
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
    }
    if (a.name.length !== b.name.length) {
      return a.name.length - b.name.length
    }
    return a.name.localeCompare(b.name)
  })

  return {
    results: matched.slice(0, limit),
    allResults: matched,
    totalMatches: matched.length,
    query: query.trim()
  }
}

