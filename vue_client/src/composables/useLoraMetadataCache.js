/**
 * useLoraMetadataCache Composable
 *
 * Provides access to the persistent LoRA metadata cache stored in the database.
 * This cache stores full LoRA details (names, images, descriptions, trained words)
 * so that when loading historical requests with minimal LoRA data, we can
 * reconstruct the full SavedLora objects.
 */

import { SavedLora } from '../models/Lora'

const API_BASE = '/api/lora-cache'

/**
 * Get a single cached LoRA by version ID
 * @param {string|number} versionId - CivitAI version ID
 * @returns {Promise<SavedLora|null>}
 */
export async function getCachedLora(versionId) {
  try {
    const response = await fetch(`${API_BASE}/${versionId}`)

    if (response.status === 404) {
      return null // Not in cache
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Convert plain object back to SavedLora instance
    return new SavedLora(data)
  } catch (error) {
    if (error.message.includes('404')) {
      return null
    }
    console.error(`Error fetching cached LoRA ${versionId}:`, error)
    return null
  }
}

/**
 * Get multiple cached LoRAs by version IDs (batch operation)
 * @param {Array<string|number>} versionIds - Array of CivitAI version IDs
 * @returns {Promise<Object>} Map of versionId -> SavedLora
 */
export async function getCachedLoras(versionIds) {
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

    // Convert plain objects back to SavedLora instances
    const resultMap = {}
    for (const [versionId, data] of Object.entries(dataMap)) {
      resultMap[versionId] = new SavedLora(data)
    }

    return resultMap
  } catch (error) {
    console.error('Error fetching cached LoRAs:', error)
    return {}
  }
}

/**
 * Cache a single LoRA's metadata
 * @param {SavedLora} lora - SavedLora instance to cache
 * @returns {Promise<boolean>} Success status
 */
export async function cacheLora(lora) {
  try {
    if (!lora.versionId || !lora.id) {
      console.warn('Cannot cache LoRA without versionId and id', lora)
      return false
    }

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lora)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error('Error caching LoRA:', error)
    return false
  }
}

/**
 * Cache multiple LoRAs (batch operation)
 * @param {Array<SavedLora>} loras - Array of SavedLora instances
 * @returns {Promise<number>} Number of LoRAs cached
 */
export async function cacheMultipleLoras(loras) {
  try {
    if (!loras || loras.length === 0) {
      return 0
    }

    // Filter out any without required IDs
    const validLoras = loras.filter(lora => lora.versionId && lora.id)

    if (validLoras.length === 0) {
      return 0
    }

    const response = await fetch(`${API_BASE}/batch-store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ loras: validLoras })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result.count || 0
  } catch (error) {
    console.error('Error caching multiple LoRAs:', error)
    return 0
  }
}

export default {
  getCachedLora,
  getCachedLoras,
  cacheLora,
  cacheMultipleLoras
}
