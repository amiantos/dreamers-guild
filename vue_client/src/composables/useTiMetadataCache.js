/**
 * useTiMetadataCache Composable
 *
 * Provides READ-ONLY access to the persistent TI metadata cache stored in the database.
 * Cache population is handled automatically by the server when TIs are fetched from CivitAI.
 * This cache stores full TI details (names, images, descriptions, trained words)
 * so that when loading historical requests with minimal TI data, we can
 * reconstruct the full SavedTextualInversion objects.
 */

import { SavedTextualInversion } from '../models/TextualInversion'

const API_BASE = '/api/ti-cache'

/**
 * Get a single cached TI by version ID
 * @param {string|number} versionId - CivitAI version ID
 * @returns {Promise<SavedTextualInversion|null>}
 */
export async function getCachedTi(versionId) {
  try {
    const response = await fetch(`${API_BASE}/${versionId}`)

    if (response.status === 404) {
      return null // Not in cache
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Convert plain object back to SavedTextualInversion instance
    return new SavedTextualInversion(data)
  } catch (error) {
    if (error.message.includes('404')) {
      return null
    }
    console.error(`Error fetching cached TI ${versionId}:`, error)
    return null
  }
}

/**
 * Get multiple cached TIs by version IDs (batch operation)
 * @param {Array<string|number>} versionIds - Array of CivitAI version IDs
 * @returns {Promise<Object>} Map of versionId -> SavedTextualInversion
 */
export async function getCachedTis(versionIds) {
  try {
    if (!versionIds || versionIds.length === 0) {
      return {}
    }

    const response = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ versionIds: versionIds.map(String) })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const dataMap = await response.json()

    // Convert plain objects back to SavedTextualInversion instances
    const resultMap = {}
    for (const [versionId, data] of Object.entries(dataMap)) {
      resultMap[versionId] = new SavedTextualInversion(data)
    }

    return resultMap
  } catch (error) {
    console.error('Error fetching cached TIs:', error)
    return {}
  }
}

export default {
  getCachedTi,
  getCachedTis
}
