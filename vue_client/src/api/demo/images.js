import * as db from './db.js'
import { estimateKudos } from './horde.js'

const blobUrlCache = new Map()

function createBlobUrl(blob, cacheKey) {
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)
  }
  const url = URL.createObjectURL(blob)
  blobUrlCache.set(cacheKey, url)
  return url
}

export function revokeBlobUrl(cacheKey) {
  const url = blobUrlCache.get(cacheKey)
  if (url) {
    URL.revokeObjectURL(url)
    blobUrlCache.delete(cacheKey)
  }
}

export function revokeAllBlobUrls() {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url)
  }
  blobUrlCache.clear()
}

function buildFilter(filters) {
  return (image) => {
    if (filters.showFavoritesOnly && !image.is_favorite) {
      return false
    }
    if (!filters.showHidden && image.is_hidden) {
      return false
    }

    // Apply flexible filter criteria if present
    if (filters.filterCriteria && filters.filterCriteria.length > 0) {
      for (const criterion of filters.filterCriteria) {
        switch (criterion.type) {
          case 'keyword': {
            const prompt = (image.prompt_simple || '').toLowerCase()
            if (!prompt.includes(criterion.value.toLowerCase())) {
              return false
            }
            break
          }
          case 'lora_id': {
            const fullRequest = image.full_request || '{}'
            if (!fullRequest.includes(`"name":"${criterion.value}"`)) {
              return false
            }
            break
          }
          case 'model': {
            const fullRequest = image.full_request || '{}'
            if (!fullRequest.includes(`"models":["${criterion.value}"`)) {
              return false
            }
            break
          }
          case 'request_id': {
            if (image.request_id !== criterion.value) {
              return false
            }
            break
          }
        }
      }
    }

    return true
  }
}

function searchFilter(keywords, filters) {
  const searchTerms = keywords.toLowerCase().split(/\s+/).filter(Boolean)

  return (image) => {
    if (filters.showFavoritesOnly && !image.is_favorite) {
      return false
    }
    if (!filters.showHidden && image.is_hidden) {
      return false
    }

    const prompt = (image.prompt_simple || '').toLowerCase()
    const model = (image.model || '').toLowerCase()

    return searchTerms.every(term =>
      prompt.includes(term) || model.includes(term)
    )
  }
}

export const imagesApi = {
  async getAll(limit = 100, offset = 0, filters = {}) {
    const filter = buildFilter(filters)
    const images = await db.getAllWithCursor('images', {
      indexName: 'date_created',
      direction: 'prev',
      limit,
      offset,
      filter
    })

    const total = await db.countWithFilter('images', filter)

    return {
      data: {
        data: images,
        total
      }
    }
  },

  async getByRequestId(requestId, limit = 100) {
    const filter = img => img.request_id === requestId

    const images = await db.getAllWithCursor('images', {
      indexName: 'date_created',
      direction: 'prev',
      limit,
      filter
    })

    // Get actual total count (not limited)
    const total = await db.countWithFilter('images', filter)

    return {
      data: {
        data: images,
        total
      }
    }
  },

  async search(keywords, limit = 100, offset = 0, filters = {}) {
    const filter = searchFilter(keywords, filters)
    const images = await db.getAllWithCursor('images', {
      indexName: 'date_created',
      direction: 'prev',
      limit,
      offset,
      filter
    })

    const total = await db.countWithFilter('images', filter)

    return {
      data: {
        data: images,
        total
      }
    }
  },

  async getById(id) {
    const image = await db.get('images', id)
    return { data: image }
  },

  getThumbnailUrl(id) {
    return `demo-blob://thumbnail/${id}`
  },

  getImageUrl(id) {
    return `demo-blob://image/${id}`
  },

  async update(id, data) {
    const image = await db.get('images', id)
    if (!image) {
      throw new Error('Image not found')
    }

    // Normalize key names (component uses camelCase, we store snake_case)
    const normalizedData = { ...data }
    if (normalizedData.isFavorite !== undefined) {
      normalizedData.is_favorite = normalizedData.isFavorite ? 1 : 0
      delete normalizedData.isFavorite
    }
    if (normalizedData.isHidden !== undefined) {
      normalizedData.is_hidden = normalizedData.isHidden ? 1 : 0
      delete normalizedData.isHidden
    }

    const updated = { ...image, ...normalizedData }
    await db.put('images', updated)
    return { data: updated }
  },

  async delete(id) {
    await db.remove('imageBlobs', id)
    await db.remove('images', id)
    revokeBlobUrl(`thumbnail-${id}`)
    revokeBlobUrl(`image-${id}`)
  },

  async batchUpdate(imageIds, updates) {
    // Normalize key names (component uses camelCase, we store snake_case)
    const normalizedUpdates = { ...updates }
    if (normalizedUpdates.isFavorite !== undefined) {
      normalizedUpdates.is_favorite = normalizedUpdates.isFavorite ? 1 : 0
      delete normalizedUpdates.isFavorite
    }
    if (normalizedUpdates.isHidden !== undefined) {
      normalizedUpdates.is_hidden = normalizedUpdates.isHidden ? 1 : 0
      delete normalizedUpdates.isHidden
    }

    for (const id of imageIds) {
      const image = await db.get('images', id)
      if (image) {
        await db.put('images', { ...image, ...normalizedUpdates })
      }
    }
    return { success: true }
  },

  async estimate(params) {
    try {
      const result = await estimateKudos(params)
      return { data: result }
    } catch (error) {
      return { data: { kudos: 0 } }
    }
  }
}

export async function resolveBlobUrl(url) {
  if (!url || !url.startsWith('demo-blob://')) {
    return url
  }

  const [, type, id] = url.match(/demo-blob:\/\/(thumbnail|image)\/(.+)/) || []
  if (!type || !id) {
    return null
  }

  const cacheKey = `${type}-${id}`
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)
  }

  const imageBlob = await db.get('imageBlobs', id)
  if (!imageBlob) {
    return null
  }

  const blob = type === 'thumbnail' ? imageBlob.thumbnail : imageBlob.fullImage
  if (!blob) {
    return null
  }

  return createBlobUrl(blob, cacheKey)
}
