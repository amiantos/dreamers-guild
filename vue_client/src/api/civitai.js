/**
 * CivitAI API Client
 *
 * In normal mode: Proxies requests through our server to CivitAI API.
 * In demo mode: Uses CivitAI's Meilisearch API directly.
 */

const isDemo = typeof __DEMO_MODE__ !== 'undefined' && __DEMO_MODE__

const CIVITAI_API_BASE = 'https://civitai.com/api/v1'
const SEARCH_API_URL = 'https://search-new.civitai.com/multi-search'
const SEARCH_API_TOKEN = '8c46eb2508e21db1e9828a97968d91ab1ca1caa5f70a00e88a2ba1e286603b61'

// Store apiClient for non-demo mode
let apiClientInstance = null

async function getApiClient() {
  if (isDemo) {
    return null
  }
  if (!apiClientInstance) {
    // Use static import at module level would be cleaner but we need conditional
    const module = await import('./client.js')
    apiClientInstance = module.default
  }
  return apiClientInstance
}

async function directCivitaiRequest(endpoint, options = {}) {
  const url = `${CIVITAI_API_BASE}${endpoint}`
  // Don't set Content-Type for GET requests - it triggers CORS preflight
  const response = await fetch(url, {
    ...options
  })
  if (!response.ok) {
    throw new Error(`CivitAI API error: ${response.status}`)
  }
  return response.json()
}

/**
 * Build Meilisearch query for CivitAI search API (demo mode)
 */
function buildMeilisearchQuery({ query = '', page = 1, limit = 100, baseModelFilters = [], nsfw = false, sort = 'Highest Rated', type = 'LORA' }) {
  const offset = (page - 1) * limit

  // Build base model filter as OR conditions
  const baseModelFilterParts = []

  if (baseModelFilters.includes('SD 1.x')) {
    baseModelFilterParts.push('"version.baseModel"="SD 1.4"')
    baseModelFilterParts.push('"version.baseModel"="SD 1.5"')
    baseModelFilterParts.push('"version.baseModel"="SD 1.5 LCM"')
  }

  if (baseModelFilters.includes('SD 2.x')) {
    baseModelFilterParts.push('"version.baseModel"="SD 2.0"')
    baseModelFilterParts.push('"version.baseModel"="SD 2.0 768"')
    baseModelFilterParts.push('"version.baseModel"="SD 2.1"')
    baseModelFilterParts.push('"version.baseModel"="SD 2.1 768"')
    baseModelFilterParts.push('"version.baseModel"="SD 2.1 Unclip"')
  }

  if (baseModelFilters.includes('SDXL')) {
    baseModelFilterParts.push('"version.baseModel"="SDXL 0.9"')
    baseModelFilterParts.push('"version.baseModel"="SDXL 1.0"')
    baseModelFilterParts.push('"version.baseModel"="SDXL 1.0 LCM"')
    baseModelFilterParts.push('"version.baseModel"="SDXL Turbo"')
  }

  if (baseModelFilters.includes('Pony')) {
    baseModelFilterParts.push('"version.baseModel"="Pony"')
  }

  if (baseModelFilters.includes('Flux')) {
    baseModelFilterParts.push('"version.baseModel"="Flux.1 S"')
    baseModelFilterParts.push('"version.baseModel"="Flux.1 D"')
  }

  if (baseModelFilters.includes('NoobAI')) {
    baseModelFilterParts.push('"version.baseModel"="NoobAI"')
  }

  if (baseModelFilters.includes('Illustrious')) {
    baseModelFilterParts.push('"version.baseModel"="Illustrious"')
  }

  // Build NSFW filter
  const nsfwLevels = nsfw
    ? 'nsfwLevel=1 OR nsfwLevel=2 OR nsfwLevel=4 OR nsfwLevel=8 OR nsfwLevel=16'
    : 'nsfwLevel=1'

  // Build complete filter array
  const filterArray = []

  if (baseModelFilterParts.length > 0) {
    filterArray.push(baseModelFilterParts)
  }

  // Add common filters as a string, including type filter
  filterArray.push(`type=${type} AND (poi != true) AND (minor != true) AND (availability != Private) AND (NOT (nsfwLevel IN [4, 8, 16, 32] AND version.baseModel IN ['SD 3', 'SD 3.5', 'SD 3.5 Medium', 'SD 3.5 Large', 'SD 3.5 Large Turbo', 'SDXL Turbo', 'SVD', 'SVD XT', 'Stable Cascade'])) AND (${nsfwLevels})`)

  // Map sort options to Meilisearch format
  const sortMapping = {
    'Highest Rated': ['metrics.thumbsUpCount:desc'],
    'Most Downloaded': ['metrics.downloadCount:desc'],
    'Newest': ['createdAt:desc']
  }

  const sortArray = sortMapping[sort] || ['metrics.thumbsUpCount:desc']

  return {
    queries: [
      {
        q: query,
        indexUid: 'models_v9',
        facets: ['category.name', 'checkpointType', 'fileFormats', 'lastVersionAtUnix', 'tags.name', 'type', 'user.username', 'version.baseModel'],
        attributesToHighlight: [],
        highlightPreTag: '__ais-highlight__',
        highlightPostTag: '__/ais-highlight__',
        limit: limit,
        offset: offset,
        filter: filterArray,
        sort: sortArray
      }
    ]
  }
}

/**
 * Transform image URL from Meilisearch format to full CivitAI URL
 */
function transformImageUrl(image) {
  if (!image || !image.url) return image

  if (!image.url.startsWith('http')) {
    return {
      ...image,
      url: `https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/${image.url}/width=450/${image.name || 'image.jpeg'}`
    }
  }

  return image
}

/**
 * Transform Meilisearch hit to CivitAI model format
 */
function transformMeilisearchHit(hit) {
  const transformedImages = (hit.images || []).map(transformImageUrl)

  const modelVersions = []

  if (hit.version) {
    const versionWithImages = {
      ...hit.version,
      images: transformedImages.length > 0 ? transformedImages : (hit.version.images || []).map(transformImageUrl),
      description: hit.version.description || ''
    }
    modelVersions.push(versionWithImages)
  }

  if (hit.versions && Array.isArray(hit.versions)) {
    hit.versions.forEach(v => {
      if (!hit.version || v.id !== hit.version.id) {
        modelVersions.push({
          ...v,
          images: (v.images || []).map(transformImageUrl),
          description: v.description || ''
        })
      }
    })
  }

  return {
    id: hit.id,
    name: hit.name,
    description: hit.description || '',
    type: hit.type,
    nsfw: hit.nsfw,
    nsfwLevel: hit.nsfwLevel,
    tags: hit.tags,
    creator: hit.user,
    stats: hit.metrics || hit.stats,
    modelVersions: modelVersions,
    versionId: modelVersions.length > 0 ? modelVersions[0].id : null,
    mode: hit.mode,
    poi: hit.poi,
    minor: hit.minor,
    allowNoCredit: hit.permissions?.allowNoCredit,
    allowCommercialUse: hit.permissions?.allowCommercialUse,
    allowDerivatives: hit.permissions?.allowDerivatives
  }
}

/**
 * Search using CivitAI REST API (demo mode)
 * Uses the public /models endpoint which supports CORS
 */
async function restApiSearch({ query, page, limit, baseModelFilters, nsfw, sort, type, signal }) {
  // Build query parameters
  const params = new URLSearchParams()

  // Set types - LORA includes LoCon
  if (type === 'LORA') {
    params.append('types', 'LORA')
    params.append('types', 'LoCon')
  } else {
    params.append('types', type)
  }

  // Only add query if not empty
  if (query && query.trim()) {
    params.append('query', query.trim())
  }

  params.append('limit', limit.toString())
  params.append('sort', sort)
  params.append('nsfw', nsfw.toString())

  // Add page only if no query (CivitAI API behavior)
  if (!query || !query.trim()) {
    params.append('page', page.toString())
  }

  // Add base model filters
  if (baseModelFilters && baseModelFilters.length > 0) {
    // Expand filter groups to actual model names
    baseModelFilters.forEach(filter => {
      if (filter === 'SD 1.x') {
        params.append('baseModels', 'SD 1.4')
        params.append('baseModels', 'SD 1.5')
        params.append('baseModels', 'SD 1.5 LCM')
      } else if (filter === 'SD 2.x') {
        params.append('baseModels', 'SD 2.0')
        params.append('baseModels', 'SD 2.0 768')
        params.append('baseModels', 'SD 2.1')
        params.append('baseModels', 'SD 2.1 768')
        params.append('baseModels', 'SD 2.1 Unclip')
      } else if (filter === 'SDXL') {
        params.append('baseModels', 'SDXL 0.9')
        params.append('baseModels', 'SDXL 1.0')
        params.append('baseModels', 'SDXL 1.0 LCM')
        params.append('baseModels', 'SDXL Turbo')
      } else if (filter === 'Pony') {
        params.append('baseModels', 'Pony')
      } else if (filter === 'Flux') {
        params.append('baseModels', 'Flux.1 S')
        params.append('baseModels', 'Flux.1 D')
      } else if (filter === 'NoobAI') {
        params.append('baseModels', 'NoobAI')
      } else if (filter === 'Illustrious') {
        params.append('baseModels', 'Illustrious')
      }
    })
  }

  const url = `${CIVITAI_API_BASE}/models?${params.toString()}`

  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`CivitAI API error: ${response.status}`)
  }

  const data = await response.json()

  // Transform response to match expected format
  const items = (data.items || []).map(item => ({
    ...item,
    // Ensure modelVersions exists
    modelVersions: item.modelVersions || [],
    // Set versionId to first version if available
    versionId: item.modelVersions && item.modelVersions.length > 0 ? item.modelVersions[0].id : null
  }))

  return {
    items: items,
    metadata: {
      currentPage: data.metadata?.currentPage || page,
      pageSize: data.metadata?.pageSize || limit,
      totalItems: data.metadata?.totalItems || items.length,
      totalPages: data.metadata?.totalPages || 1,
      nextPage: data.metadata?.nextPage || null,
      prevPage: data.metadata?.prevPage || null
    }
  }
}

/**
 * Search LoRAs via server proxy
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 * @param {Array<string>} params.baseModelFilters - Base model filters
 * @param {boolean} params.nsfw - Include NSFW results
 * @param {string} params.sort - Sort order (Highest Rated, Most Downloaded, Newest)
 * @param {string} params.url - Direct URL to fetch (for pagination)
 * @param {AbortSignal} params.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Response with items and metadata
 */
export async function searchLoras({
  query = '',
  page = 1,
  limit = 100,
  baseModelFilters = [],
  nsfw = false,
  sort = 'Highest Rated',
  url = null,
  signal = null
}) {
  try {
    if (isDemo) {
      // Use CivitAI REST API directly
      return await restApiSearch({
        query,
        page,
        limit,
        baseModelFilters,
        nsfw,
        sort,
        type: 'LORA',
        signal
      })
    }

    const apiClient = await getApiClient()
    const response = await apiClient.post('/civitai/search', {
      query,
      page,
      limit,
      baseModelFilters,
      nsfw,
      sort,
      url
    }, { signal });

    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      console.log('Request was aborted');
      throw error;
    }

    console.error('Error fetching CivitAI results:', error);
    throw error;
  }
}

/**
 * Get a specific LoRA model by ID via server proxy
 * @param {string|number} modelId - CivitAI model ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Model data
 */
export async function getLoraById(modelId, signal = null) {
  try {
    if (isDemo) {
      return await directCivitaiRequest(`/models/${modelId}`, { signal })
    }
    const apiClient = await getApiClient()
    const response = await apiClient.get(`/civitai/models/${modelId}`, { signal });
    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      console.log('Request was aborted');
      throw error;
    }

    console.error('Error fetching LoRA by ID:', error);
    throw error;
  }
}

/**
 * Get a LoRA model by version ID via server proxy
 * @param {string|number} versionId - CivitAI version ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Model data with all versions
 */
export async function getLoraByVersionId(versionId, signal = null) {
  try {
    if (isDemo) {
      const versionData = await directCivitaiRequest(`/model-versions/${versionId}`, { signal })
      // Fetch full model data to get all versions
      if (versionData.modelId) {
        return await directCivitaiRequest(`/models/${versionData.modelId}`, { signal })
      }
      return versionData
    }
    const apiClient = await getApiClient()
    const response = await apiClient.get(`/civitai/model-versions/${versionId}`, { signal });
    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      console.log('Request was aborted');
      throw error;
    }

    console.error('Error fetching LoRA by version ID:', error);
    throw error;
  }
}

/**
 * Search Textual Inversions via server proxy
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 * @param {Array<string>} params.baseModelFilters - Base model filters
 * @param {boolean} params.nsfw - Include NSFW results
 * @param {string} params.sort - Sort order (Highest Rated, Most Downloaded, Newest)
 * @param {string} params.url - Direct URL to fetch (for pagination)
 * @param {AbortSignal} params.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Response with items and metadata
 */
export async function searchTextualInversions({
  query = '',
  page = 1,
  limit = 100,
  baseModelFilters = [],
  nsfw = false,
  sort = 'Highest Rated',
  url = null,
  signal = null
}) {
  try {
    if (isDemo) {
      // Use CivitAI REST API directly
      return await restApiSearch({
        query,
        page,
        limit,
        baseModelFilters,
        nsfw,
        sort,
        type: 'TextualInversion',
        signal
      })
    }

    const apiClient = await getApiClient()
    const response = await apiClient.post('/civitai/search-tis', {
      query,
      page,
      limit,
      baseModelFilters,
      nsfw,
      sort,
      url
    }, { signal });

    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      console.log('Request was aborted');
      throw error;
    }

    console.error('Error fetching CivitAI TI results:', error);
    throw error;
  }
}

/**
 * Get a specific TI model by ID via server proxy
 * @param {string|number} modelId - CivitAI model ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Model data
 */
export async function getTiById(modelId, signal = null) {
  try {
    if (isDemo) {
      return await directCivitaiRequest(`/models/${modelId}`, { signal })
    }
    const apiClient = await getApiClient()
    const response = await apiClient.get(`/civitai/ti-models/${modelId}`, { signal });
    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      console.log('Request was aborted');
      throw error;
    }

    console.error('Error fetching TI by ID:', error);
    throw error;
  }
}

/**
 * Get a TI model by version ID via server proxy
 * @param {string|number} versionId - CivitAI version ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Model data with all versions
 */
export async function getTiByVersionId(versionId, signal = null) {
  try {
    if (isDemo) {
      const versionData = await directCivitaiRequest(`/model-versions/${versionId}`, { signal })
      // Fetch full model data to get all versions
      if (versionData.modelId) {
        return await directCivitaiRequest(`/models/${versionData.modelId}`, { signal })
      }
      return versionData
    }
    const apiClient = await getApiClient()
    const response = await apiClient.get(`/civitai/ti-versions/${versionId}`, { signal });
    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      console.log('Request was aborted');
      throw error;
    }

    console.error('Error fetching TI by version ID:', error);
    throw error;
  }
}

export default {
  searchLoras,
  getLoraById,
  getLoraByVersionId,
  searchTextualInversions,
  getTiById,
  getTiByVersionId
};
