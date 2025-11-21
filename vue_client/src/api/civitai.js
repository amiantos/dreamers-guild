/**
 * CivitAI API Client
 *
 * Handles requests to CivitAI API for searching and fetching LoRA models.
 * Implements caching to reduce API calls and improve performance.
 */

const API_BASE_URL = 'https://civitai.com/api/v1'
const CACHE_PREFIX = 'civitai_cache_'
const CACHE_TTL = 60 * 60 * 1000 // 60 minutes

/**
 * Build query string for CivitAI API
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 * @param {Array<string>} params.baseModelFilters - Base model filters
 * @param {boolean} params.nsfw - Include NSFW results
 * @returns {string} Query string
 */
function buildQueryString({ query = '', page = 1, limit = 20, baseModelFilters = [], nsfw = false }) {
  const params = new URLSearchParams()

  // LoRA types
  params.append('types', 'LORA')
  params.append('types', 'LoCon')

  // Sorting
  params.append('sort', 'Highest Rated')

  // Limit
  params.append('limit', limit)

  // Search query
  if (query) {
    params.append('query', query)
  } else {
    // Only add page if no query (CivitAI pagination works differently for searches)
    params.append('page', page)
  }

  // NSFW
  params.append('nsfw', nsfw)

  // Base model filters
  if (baseModelFilters.includes('SD 1.x')) {
    ['1.4', '1.5', '1.5 LCM'].forEach(version => {
      params.append('baseModels', `SD ${version}`)
    })
  }

  if (baseModelFilters.includes('SD 2.x')) {
    ['2.0', '2.0 768', '2.1', '2.1 768', '2.1 Unclip'].forEach(version => {
      params.append('baseModels', `SD ${version}`)
    })
  }

  if (baseModelFilters.includes('SDXL')) {
    ['0.9', '1.0', '1.0 LCM', 'Turbo'].forEach(version => {
      params.append('baseModels', `SDXL ${version}`)
    })
  }

  if (baseModelFilters.includes('Pony')) {
    params.append('baseModels', 'Pony')
  }

  if (baseModelFilters.includes('Flux')) {
    params.append('baseModels', 'Flux.1 S')
    params.append('baseModels', 'Flux.1 D')
  }

  if (baseModelFilters.includes('NoobAI')) {
    params.append('baseModels', 'NoobAI')
  }

  if (baseModelFilters.includes('Illustrious')) {
    params.append('baseModels', 'Illustrious')
  }

  return params.toString()
}

/**
 * Generate cache key for a search
 * @param {Object} params - Search parameters
 * @returns {string} Cache key
 */
function getCacheKey(params) {
  const key = `${params.query || 'default'}_${params.page || 1}_${(params.baseModelFilters || []).sort().join(',')}_${params.nsfw}`
  return `${CACHE_PREFIX}${key}`
}

/**
 * Get cached data if available and not expired
 * @param {string} cacheKey - Cache key
 * @returns {Object|null} Cached data or null
 */
function getCachedData(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const now = Date.now()

    if (now - timestamp > CACHE_TTL) {
      // Expired, remove it
      localStorage.removeItem(cacheKey)
      return null
    }

    return data
  } catch (error) {
    console.error('Error reading cache:', error)
    return null
  }
}

/**
 * Save data to cache
 * @param {string} cacheKey - Cache key
 * @param {Object} data - Data to cache
 */
function setCachedData(cacheKey, data) {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry))
  } catch (error) {
    console.error('Error writing cache:', error)
  }
}

/**
 * Clear all CivitAI cache
 */
export function clearCivitaiCache() {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

/**
 * Search LoRAs on CivitAI
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 * @param {Array<string>} params.baseModelFilters - Base model filters
 * @param {boolean} params.nsfw - Include NSFW results
 * @param {string} params.url - Direct URL to fetch (for pagination)
 * @param {AbortSignal} params.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Response with items and metadata
 */
export async function searchLoras({
  query = '',
  page = 1,
  limit = 20,
  baseModelFilters = [],
  nsfw = false,
  url = null,
  signal = null
}) {
  try {
    let fetchUrl

    if (url) {
      // Direct URL provided (for pagination)
      fetchUrl = url.startsWith('http') ? url : `${API_BASE_URL}/models?${url}`
    } else {
      // Build query string
      const queryString = buildQueryString({ query, page, limit, baseModelFilters, nsfw })
      fetchUrl = `${API_BASE_URL}/models?${queryString}`

      // Check cache
      const cacheKey = getCacheKey({ query, page, baseModelFilters, nsfw })
      const cached = getCachedData(cacheKey)
      if (cached) {
        return { ...cached, cached: true }
      }
    }

    // Fetch from API
    const response = await fetch(fetchUrl, { signal })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Cache the result (if not using direct URL)
    if (!url) {
      const cacheKey = getCacheKey({ query, page, baseModelFilters, nsfw })
      setCachedData(cacheKey, data)
    }

    return {
      items: data.items || [],
      metadata: data.metadata || {
        nextPage: null,
        currentPage: page,
        pageSize: limit
      },
      cached: false
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was aborted')
      throw error
    }

    console.error('Error fetching CivitAI results:', error)
    throw error
  }
}

/**
 * Get a specific LoRA model by ID
 * @param {string|number} modelId - CivitAI model ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Model data
 */
export async function getLoraById(modelId, signal = null) {
  try {
    const cacheKey = `${CACHE_PREFIX}model_${modelId}`
    const cached = getCachedData(cacheKey)
    if (cached) {
      return { ...cached, cached: true }
    }

    const response = await fetch(`${API_BASE_URL}/models/${modelId}`, { signal })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Cache the result
    setCachedData(cacheKey, data)

    return { ...data, cached: false }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was aborted')
      throw error
    }

    console.error('Error fetching LoRA by ID:', error)
    throw error
  }
}

/**
 * Get a LoRA model by version ID (two-step process)
 * 1. Fetch version data to get model ID
 * 2. Fetch full model data using model ID
 * @param {string|number} versionId - CivitAI version ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Model data with all versions
 */
export async function getLoraByVersionId(versionId, signal = null) {
  try {
    // Check cache first (try to find by version ID in our cache)
    const versionCacheKey = `${CACHE_PREFIX}version_${versionId}`
    const cached = getCachedData(versionCacheKey)
    if (cached) {
      return { ...cached, cached: true }
    }

    // Step 1: Fetch version data to get model ID
    const versionResponse = await fetch(
      `${API_BASE_URL}/model-versions/${versionId}`,
      { signal }
    )

    if (!versionResponse.ok) {
      throw new Error(`HTTP error! status: ${versionResponse.status}`)
    }

    const versionData = await versionResponse.json()
    const modelId = versionData.modelId

    // Step 2: Fetch full model data using model ID
    const modelData = await getLoraById(modelId, signal)

    // Cache the result under version ID for future lookups
    setCachedData(versionCacheKey, modelData)

    return { ...modelData, cached: false }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was aborted')
      throw error
    }

    console.error('Error fetching LoRA by version ID:', error)
    throw error
  }
}

export default {
  searchLoras,
  getLoraById,
  getLoraByVersionId,
  clearCivitaiCache
}
