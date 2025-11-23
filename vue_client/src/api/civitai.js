/**
 * CivitAI API Client
 *
 * Proxies requests through our server to CivitAI API.
 * Server handles caching and rate limiting.
 */

import apiClient from './client.js';

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

export default {
  searchLoras,
  getLoraById,
  getLoraByVersionId
};
