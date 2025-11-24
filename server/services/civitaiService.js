/**
 * CivitAI API Service
 *
 * Server-side proxy for CivitAI API requests.
 * Implements database caching to reduce API calls and improve performance.
 */

import { CivitaiSearchCache, LoraCache, TiCache } from '../db/models.js';

const API_BASE_URL = 'https://civitai.com/api/v1';
const SEARCH_API_URL = 'https://search-new.civitai.com/multi-search';
const SEARCH_API_TOKEN = '8c46eb2508e21db1e9828a97968d91ab1ca1caa5f70a00e88a2ba1e286603b61';
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes

/**
 * Build Meilisearch query for CivitAI search API
 */
function buildMeilisearchQuery({ query = '', page = 1, limit = 100, baseModelFilters = [], nsfw = false, sort = 'Highest Rated' }) {
  // Calculate offset from page
  const offset = (page - 1) * limit;

  // Build base model filter as OR conditions
  const baseModelFilterParts = [];

  if (baseModelFilters.includes('SD 1.x')) {
    baseModelFilterParts.push('"version.baseModel"="SD 1.4"');
    baseModelFilterParts.push('"version.baseModel"="SD 1.5"');
    baseModelFilterParts.push('"version.baseModel"="SD 1.5 LCM"');
  }

  if (baseModelFilters.includes('SD 2.x')) {
    baseModelFilterParts.push('"version.baseModel"="SD 2.0"');
    baseModelFilterParts.push('"version.baseModel"="SD 2.0 768"');
    baseModelFilterParts.push('"version.baseModel"="SD 2.1"');
    baseModelFilterParts.push('"version.baseModel"="SD 2.1 768"');
    baseModelFilterParts.push('"version.baseModel"="SD 2.1 Unclip"');
  }

  if (baseModelFilters.includes('SDXL')) {
    baseModelFilterParts.push('"version.baseModel"="SDXL 0.9"');
    baseModelFilterParts.push('"version.baseModel"="SDXL 1.0"');
    baseModelFilterParts.push('"version.baseModel"="SDXL 1.0 LCM"');
    baseModelFilterParts.push('"version.baseModel"="SDXL Turbo"');
  }

  if (baseModelFilters.includes('Pony')) {
    baseModelFilterParts.push('"version.baseModel"="Pony"');
  }

  if (baseModelFilters.includes('Flux')) {
    baseModelFilterParts.push('"version.baseModel"="Flux.1 S"');
    baseModelFilterParts.push('"version.baseModel"="Flux.1 D"');
  }

  if (baseModelFilters.includes('NoobAI')) {
    baseModelFilterParts.push('"version.baseModel"="NoobAI"');
  }

  if (baseModelFilters.includes('Illustrious')) {
    baseModelFilterParts.push('"version.baseModel"="Illustrious"');
  }

  // Build NSFW filter
  const nsfwLevels = nsfw
    ? 'nsfwLevel=1 OR nsfwLevel=2 OR nsfwLevel=4 OR nsfwLevel=8 OR nsfwLevel=16'
    : 'nsfwLevel=1';

  // Build complete filter array (matching the structure from the curl example)
  // The filter structure is: [[array of base model OR conditions], "remaining AND conditions"]
  const filterArray = [];

  // Add base model filter array if any selected
  if (baseModelFilterParts.length > 0) {
    filterArray.push(baseModelFilterParts);
  }

  // Add common filters as a string, including LORA type filter
  filterArray.push('type=LORA AND (poi != true) AND (minor != true) AND (availability != Private) AND (NOT (nsfwLevel IN [4, 8, 16, 32] AND version.baseModel IN [\'SD 3\', \'SD 3.5\', \'SD 3.5 Medium\', \'SD 3.5 Large\', \'SD 3.5 Large Turbo\', \'SDXL Turbo\', \'SVD\', \'SVD XT\', \'Stable Cascade\'])) AND (' + nsfwLevels + ')');

  const filter = filterArray;

  // Map sort options to Meilisearch format
  // Meilisearch uses 'sort' parameter with field:direction format
  const sortMapping = {
    'Highest Rated': ['metrics.thumbsUpCount:desc'],
    'Most Downloaded': ['metrics.downloadCount:desc'],
    'Newest': ['createdAt:desc']
  };

  const sortArray = sortMapping[sort] || ['metrics.thumbsUpCount:desc'];

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
        filter: filter,
        sort: sortArray
      }
    ]
  };
}

/**
 * Generate cache key for a search
 */
function getCacheKey({ query = '', page = 1, limit = 100, baseModelFilters = [], nsfw = false, sort = 'Highest Rated' }) {
  return `${query || 'default'}_p${page}_${limit}_${sort}_${(baseModelFilters || []).sort().join(',')}_${nsfw}`;
}

/**
 * Cache a model's versions in LoraCache for long-term persistence
 * This allows us to enrich historical requests with full LoRA metadata
 */
function cacheModelVersions(modelData) {
  try {
    if (!modelData || !modelData.modelVersions || !Array.isArray(modelData.modelVersions)) {
      return;
    }

    // Cache each version with the full model data
    for (const version of modelData.modelVersions) {
      if (version.id) {
        LoraCache.set(
          String(version.id),
          String(modelData.id),
          modelData
        );
      }
    }
  } catch (error) {
    console.error('[CivitAI] Error caching model versions:', error);
  }
}

/**
 * Cache a model's versions in TiCache for long-term persistence
 * This allows us to enrich historical requests with full TI metadata
 */
function cacheTiVersions(modelData) {
  try {
    if (!modelData || !modelData.modelVersions || !Array.isArray(modelData.modelVersions)) {
      return;
    }

    // Cache each version with the full model data
    for (const version of modelData.modelVersions) {
      if (version.id) {
        TiCache.set(
          String(version.id),
          String(modelData.id),
          modelData
        );
      }
    }
  } catch (error) {
    console.error('[CivitAI] Error caching TI versions:', error);
  }
}

/**
 * Transform image URL from Meilisearch format to full CivitAI URL
 */
function transformImageUrl(image) {
  if (!image || !image.url) return image;

  // If URL is just a UUID, convert to full CivitAI image URL
  if (!image.url.startsWith('http')) {
    return {
      ...image,
      url: `https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/${image.url}/width=450/${image.name || 'image.jpeg'}`
    };
  }

  return image;
}

/**
 * Fetch additional version details from CivitAI API if needed
 * The Meilisearch API doesn't include file info or full descriptions
 */
async function enrichVersionData(version) {
  // If we already have files, no need to fetch
  if (version.files && version.files.length > 0) {
    return version;
  }

  try {
    // Fetch full version data from CivitAI API
    const response = await fetch(`${API_BASE_URL}/model-versions/${version.id}`);
    if (!response.ok) {
      console.warn(`[CivitAI] Failed to fetch version details for ${version.id}`);
      return version;
    }

    const versionData = await response.json();

    return {
      ...version,
      files: versionData.files || [],
      description: versionData.description || version.description,
      downloadUrl: versionData.downloadUrl || version.downloadUrl
    };
  } catch (error) {
    console.warn(`[CivitAI] Error enriching version ${version.id}:`, error);
    return version;
  }
}

/**
 * Transform Meilisearch hit to CivitAI model format
 */
function transformMeilisearchHit(hit) {
  // Meilisearch returns a different structure, we need to transform it
  // to match the expected CivitAI API format

  // Transform images to have full URLs
  const transformedImages = (hit.images || []).map(transformImageUrl);

  // Build modelVersions array from Meilisearch structure
  const modelVersions = [];

  // Meilisearch has a 'version' field with the current version
  // and a 'versions' array with all versions
  if (hit.version) {
    // Add images to the version if they're at the top level
    const versionWithImages = {
      ...hit.version,
      images: transformedImages.length > 0 ? transformedImages : (hit.version.images || []).map(transformImageUrl),
      // Ensure description is included
      description: hit.version.description || ''
    };
    modelVersions.push(versionWithImages);
  }

  // Add other versions if available
  if (hit.versions && Array.isArray(hit.versions)) {
    hit.versions.forEach(v => {
      // Don't duplicate the main version
      if (!hit.version || v.id !== hit.version.id) {
        // For additional versions, we may need to fetch their images separately
        // since Meilisearch only includes images for the primary version
        modelVersions.push({
          ...v,
          images: (v.images || []).map(transformImageUrl),
          description: v.description || ''
        });
      }
    });
  }

  return {
    id: hit.id,
    name: hit.name,
    // Meilisearch doesn't have a top-level description field
    // It's typically in the version descriptions
    description: hit.description || '',
    type: hit.type,
    nsfw: hit.nsfw,
    nsfwLevel: hit.nsfwLevel,
    tags: hit.tags,
    creator: hit.user,
    stats: hit.metrics || hit.stats,
    modelVersions: modelVersions,
    // Set versionId to the first (primary) version's ID for easy access
    versionId: modelVersions.length > 0 ? modelVersions[0].id : null,
    // Preserve other useful fields
    mode: hit.mode,
    poi: hit.poi,
    minor: hit.minor,
    allowNoCredit: hit.permissions?.allowNoCredit,
    allowCommercialUse: hit.permissions?.allowCommercialUse,
    allowDerivatives: hit.permissions?.allowDerivatives
  };
}

/**
 * Search LoRAs on CivitAI using new Meilisearch API
 */
export async function searchLoras({
  query = '',
  page = 1,
  limit = 100,
  baseModelFilters = [],
  nsfw = false,
  sort = 'Highest Rated',
  url = null
}) {
  try {
    // Build Meilisearch query
    const searchQuery = buildMeilisearchQuery({ query, page, limit, baseModelFilters, nsfw, sort });

    // CACHE DISABLED FOR DEBUGGING
    // const cacheKey = getCacheKey({ query, page, limit, baseModelFilters, nsfw, sort });
    // const cached = CivitaiSearchCache.get(cacheKey);
    // if (cached && (Date.now() - cached.cached_at < CACHE_TTL)) {
    //   console.log(`[CivitAI] Cache hit for search: ${cacheKey}`);
    //   return {
    //     ...cached.result_data,
    //     cached: true
    //   };
    // }

    // Fetch from CivitAI Meilisearch API
    console.log(`[CivitAI] Fetching from Meilisearch API with query:`, JSON.stringify(searchQuery, null, 2));
    const response = await fetch(SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEARCH_API_TOKEN}`,
        'Origin': 'https://civitai.com',
        'Referer': 'https://civitai.com/'
      },
      body: JSON.stringify(searchQuery)
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        }
        console.error('[CivitAI] API Error Response:', errorData);
      } catch (e) {
        // Could not parse error response as JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Log the actual response for debugging
    console.log(`[CivitAI] Meilisearch API returned:`, JSON.stringify(data, null, 2));

    // Extract results from Meilisearch response
    const results = data.results && data.results[0] ? data.results[0] : { hits: [], estimatedTotalHits: 0 };
    const hits = results.hits || [];
    const totalHits = results.estimatedTotalHits || 0;

    // Transform hits to match expected format
    const items = hits.map(transformMeilisearchHit);

    // Log transformed data
    console.log(`[CivitAI] Transformed ${items.length} items`);

    // CACHE DISABLED FOR DEBUGGING
    // const cacheKey = getCacheKey({ query, page, limit, baseModelFilters, nsfw, sort });
    // CivitaiSearchCache.set(cacheKey, { items, metadata });

    // Cache all model versions in LoraCache for long-term persistence
    for (const model of items) {
      cacheModelVersions(model);
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalHits / limit);
    const hasNextPage = page < totalPages;

    return {
      items: items,
      metadata: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalHits,
        totalPages: totalPages,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      },
      cached: false
    };
  } catch (error) {
    console.error('[CivitAI] Error searching LoRAs:', error);
    throw error;
  }
}

/**
 * Get a specific LoRA model by ID
 */
export async function getLoraById(modelId) {
  try {
    const cacheKey = `model_${modelId}`;
    const cached = CivitaiSearchCache.get(cacheKey);

    if (cached && (Date.now() - cached.cached_at < CACHE_TTL)) {
      console.log(`[CivitAI] Cache hit for model: ${modelId}`);
      return {
        ...cached.result_data,
        cached: true
      };
    }

    // Fetch from CivitAI API
    console.log(`[CivitAI] Fetching model from API: ${modelId}`);
    const response = await fetch(`${API_BASE_URL}/models/${modelId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    CivitaiSearchCache.set(cacheKey, data);

    // Cache model versions in LoraCache for long-term persistence
    cacheModelVersions(data);

    return {
      ...data,
      cached: false
    };
  } catch (error) {
    console.error(`[CivitAI] Error fetching model ${modelId}:`, error);
    throw error;
  }
}

/**
 * Get a LoRA model by version ID (two-step process)
 * Checks LoraCache first for long-term persistence, then CivitaiSearchCache, then API
 */
export async function getLoraByVersionId(versionId) {
  try {
    // Check long-term LoraCache first
    const loraCached = LoraCache.get(String(versionId));
    if (loraCached) {
      console.log(`[CivitAI] LoraCache hit for version: ${versionId}`);
      return {
        ...loraCached.full_metadata,
        cached: true
      };
    }

    // Check short-term CivitaiSearchCache
    const cacheKey = `version_${versionId}`;
    const cached = CivitaiSearchCache.get(cacheKey);

    if (cached && (Date.now() - cached.cached_at < CACHE_TTL)) {
      console.log(`[CivitAI] SearchCache hit for version: ${versionId}`);
      return {
        ...cached.result_data,
        cached: true
      };
    }

    // Step 1: Fetch version data to get model ID
    console.log(`[CivitAI] Fetching version from API: ${versionId}`);
    const versionResponse = await fetch(`${API_BASE_URL}/model-versions/${versionId}`);

    if (!versionResponse.ok) {
      throw new Error(`HTTP error! status: ${versionResponse.status}`);
    }

    const versionData = await versionResponse.json();
    const modelId = versionData.modelId;

    // Step 2: Fetch full model data using model ID
    const modelData = await getLoraById(modelId);

    // Cache the result under version ID for future lookups
    CivitaiSearchCache.set(cacheKey, modelData);

    // Cache model versions in LoraCache for long-term persistence
    cacheModelVersions(modelData);

    return {
      ...modelData,
      cached: false
    };
  } catch (error) {
    console.error(`[CivitAI] Error fetching version ${versionId}:`, error);
    throw error;
  }
}

/**
 * Search Textual Inversions on CivitAI using Meilisearch API
 */
export async function searchTextualInversions({
  query = '',
  page = 1,
  limit = 100,
  baseModelFilters = [],
  nsfw = false,
  sort = 'Highest Rated',
  url = null
}) {
  try {
    // Build Meilisearch query with TI type filter
    const searchQuery = buildMeilisearchQuery({ query, page, limit, baseModelFilters, nsfw, sort });

    // Replace LORA type filter with TextualInversion type filter
    searchQuery.queries[0].filter = searchQuery.queries[0].filter.map(filter => {
      if (typeof filter === 'string') {
        return filter.replace('type=LORA', 'type=TextualInversion');
      }
      return filter;
    });

    // Fetch from CivitAI Meilisearch API
    console.log(`[CivitAI] Fetching TIs from Meilisearch API with query:`, JSON.stringify(searchQuery, null, 2));
    const response = await fetch(SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEARCH_API_TOKEN}`,
        'Origin': 'https://civitai.com',
        'Referer': 'https://civitai.com/'
      },
      body: JSON.stringify(searchQuery)
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        }
        console.error('[CivitAI] API Error Response:', errorData);
      } catch (e) {
        // Could not parse error response as JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Extract results from Meilisearch response
    const results = data.results && data.results[0] ? data.results[0] : { hits: [], estimatedTotalHits: 0 };
    const hits = results.hits || [];
    const totalHits = results.estimatedTotalHits || 0;

    // Transform hits to match expected format
    const items = hits.map(transformMeilisearchHit);

    console.log(`[CivitAI] Transformed ${items.length} TI items`);

    // Cache all model versions in TiCache for long-term persistence
    for (const model of items) {
      cacheTiVersions(model);
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalHits / limit);
    const hasNextPage = page < totalPages;

    return {
      items: items,
      metadata: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalHits,
        totalPages: totalPages,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      },
      cached: false
    };
  } catch (error) {
    console.error('[CivitAI] Error searching Textual Inversions:', error);
    throw error;
  }
}

/**
 * Get a specific TI model by ID
 */
export async function getTiById(modelId) {
  try {
    const cacheKey = `ti_model_${modelId}`;
    const cached = CivitaiSearchCache.get(cacheKey);

    if (cached && (Date.now() - cached.cached_at < CACHE_TTL)) {
      console.log(`[CivitAI] Cache hit for TI model: ${modelId}`);
      return {
        ...cached.result_data,
        cached: true
      };
    }

    // Fetch from CivitAI API
    console.log(`[CivitAI] Fetching TI model from API: ${modelId}`);
    const response = await fetch(`${API_BASE_URL}/models/${modelId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    CivitaiSearchCache.set(cacheKey, data);

    // Cache model versions in TiCache for long-term persistence
    cacheTiVersions(data);

    return {
      ...data,
      cached: false
    };
  } catch (error) {
    console.error(`[CivitAI] Error fetching TI model ${modelId}:`, error);
    throw error;
  }
}

/**
 * Get a TI model by version ID (two-step process)
 * Checks TiCache first for long-term persistence, then CivitaiSearchCache, then API
 */
export async function getTiByVersionId(versionId) {
  try {
    // Check long-term TiCache first
    const tiCached = TiCache.get(String(versionId));
    if (tiCached) {
      console.log(`[CivitAI] TiCache hit for version: ${versionId}`);
      return {
        ...tiCached.full_metadata,
        cached: true
      };
    }

    // Check short-term CivitaiSearchCache
    const cacheKey = `ti_version_${versionId}`;
    const cached = CivitaiSearchCache.get(cacheKey);

    if (cached && (Date.now() - cached.cached_at < CACHE_TTL)) {
      console.log(`[CivitAI] SearchCache hit for TI version: ${versionId}`);
      return {
        ...cached.result_data,
        cached: true
      };
    }

    // Step 1: Fetch version data to get model ID
    console.log(`[CivitAI] Fetching TI version from API: ${versionId}`);
    const versionResponse = await fetch(`${API_BASE_URL}/model-versions/${versionId}`);

    if (!versionResponse.ok) {
      throw new Error(`HTTP error! status: ${versionResponse.status}`);
    }

    const versionData = await versionResponse.json();
    const modelId = versionData.modelId;

    // Step 2: Fetch full model data using model ID
    const modelData = await getTiById(modelId);

    // Cache the result under version ID for future lookups
    CivitaiSearchCache.set(cacheKey, modelData);

    // Cache model versions in TiCache for long-term persistence
    cacheTiVersions(modelData);

    return {
      ...modelData,
      cached: false
    };
  } catch (error) {
    console.error(`[CivitAI] Error fetching TI version ${versionId}:`, error);
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
