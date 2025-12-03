/**
 * Demo Mode Albums API
 * Uses localStorage for album storage and image associations
 */

const ALBUMS_KEY = 'demo_albums'
const IMAGE_ALBUMS_KEY = 'demo_image_albums'

/**
 * Generate a URL-friendly slug from title
 */
function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}

/**
 * Get all albums from localStorage
 */
function getAlbums() {
  try {
    const data = localStorage.getItem(ALBUMS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Save albums to localStorage
 */
function saveAlbums(albums) {
  localStorage.setItem(ALBUMS_KEY, JSON.stringify(albums))
}

/**
 * Get image-album associations
 */
function getImageAlbums() {
  try {
    const data = localStorage.getItem(IMAGE_ALBUMS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Save image-album associations
 */
function saveImageAlbums(associations) {
  localStorage.setItem(IMAGE_ALBUMS_KEY, JSON.stringify(associations))
}

/**
 * Get next album ID
 */
function getNextId() {
  const albums = getAlbums()
  return albums.length > 0 ? Math.max(...albums.map(a => a.id)) + 1 : 1
}

/**
 * Compute album count and thumbnail
 */
function enrichAlbum(album) {
  const associations = getImageAlbums()
  const albumImages = associations
    .filter(a => a.album_id === album.id)
    .sort((a, b) => b.date_added - a.date_added)

  return {
    ...album,
    type: 'user',
    count: albumImages.length,
    thumbnail: album.cover_image_uuid || (albumImages[0]?.image_uuid || null)
  }
}

export const albumsApi = {
  /**
   * Get all albums
   */
  getAll(options = {}) {
    const { includeHidden = false } = options
    let albums = getAlbums()

    if (!includeHidden) {
      albums = albums.filter(a => !a.is_hidden)
    }

    // Sort by sort_order then date_created
    albums.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return b.date_created - a.date_created
    })

    const enriched = albums.map(enrichAlbum)
    return Promise.resolve({ data: enriched })
  },

  /**
   * Create new album
   */
  create(data) {
    const albums = getAlbums()
    const now = Date.now()

    const newAlbum = {
      id: getNextId(),
      slug: generateSlug(data.title),
      title: data.title,
      is_hidden: data.isHidden ? 1 : 0,
      cover_image_uuid: null,
      date_created: now,
      date_modified: now,
      sort_order: 0
    }

    albums.unshift(newAlbum)
    saveAlbums(albums)

    return Promise.resolve({ data: enrichAlbum(newAlbum) })
  },

  /**
   * Get album by slug
   */
  getBySlug(slug) {
    const albums = getAlbums()
    const album = albums.find(a => a.slug === slug)

    if (!album) {
      return Promise.reject(new Error('Album not found'))
    }

    return Promise.resolve({ data: enrichAlbum(album) })
  },

  /**
   * Update album
   */
  update(id, data) {
    const albums = getAlbums()
    const index = albums.findIndex(a => a.id === id)

    if (index === -1) {
      return Promise.reject(new Error('Album not found'))
    }

    const album = albums[index]

    if (data.title !== undefined) {
      album.title = data.title
      album.slug = generateSlug(data.title)
    }
    if (data.isHidden !== undefined) {
      album.is_hidden = data.isHidden ? 1 : 0
    }
    if (data.coverImageUuid !== undefined) {
      album.cover_image_uuid = data.coverImageUuid
    }
    if (data.sortOrder !== undefined) {
      album.sort_order = data.sortOrder
    }

    album.date_modified = Date.now()
    albums[index] = album
    saveAlbums(albums)

    return Promise.resolve({ data: enrichAlbum(album) })
  },

  /**
   * Delete album
   */
  delete(id) {
    let albums = getAlbums()
    albums = albums.filter(a => a.id !== id)
    saveAlbums(albums)

    // Remove image associations
    let associations = getImageAlbums()
    associations = associations.filter(a => a.album_id !== id)
    saveImageAlbums(associations)

    return Promise.resolve({ success: true })
  },

  /**
   * Get images in album
   */
  async getImages(albumId, limit = 20, offset = 0, options = {}) {
    const associations = getImageAlbums()
    const albumImageUuids = associations
      .filter(a => a.album_id === albumId)
      .sort((a, b) => b.date_added - a.date_added)
      .map(a => a.image_uuid)

    // Get images from IndexedDB
    const { getAll: dbGetAll } = await import('./db.js')
    let images = await dbGetAll('images')

    // Filter to album images
    images = images.filter(img => albumImageUuids.includes(img.uuid))

    // Apply filters
    if (options.showFavorites) {
      images = images.filter(img => img.is_favorite)
    }
    if (options.showHiddenOnly) {
      images = images.filter(img => img.is_hidden)
    }
    if (options.keywords && options.keywords.length > 0) {
      const keywords = options.keywords.map(k => k.toLowerCase())
      images = images.filter(img => {
        const prompt = (img.prompt_simple || '').toLowerCase()
        return keywords.some(k => prompt.includes(k))
      })
    }

    // Sort by date added to album
    images.sort((a, b) => {
      const aIndex = albumImageUuids.indexOf(a.uuid)
      const bIndex = albumImageUuids.indexOf(b.uuid)
      return aIndex - bIndex
    })

    const total = images.length
    const paged = images.slice(offset, offset + limit)

    return Promise.resolve({
      data: {
        images: paged,
        total,
        limit,
        offset
      }
    })
  },

  /**
   * Add images to album
   */
  addImages(albumId, imageIds) {
    const associations = getImageAlbums()
    const now = Date.now()
    let added = 0

    for (const imageUuid of imageIds) {
      // Check if already exists
      const exists = associations.some(
        a => a.album_id === albumId && a.image_uuid === imageUuid
      )
      if (!exists) {
        associations.push({
          album_id: albumId,
          image_uuid: imageUuid,
          date_added: now
        })
        added++
      }
    }

    saveImageAlbums(associations)

    return Promise.resolve({ success: true, added, albumId })
  },

  /**
   * Remove image from album
   */
  removeImage(albumId, imageId) {
    let associations = getImageAlbums()
    associations = associations.filter(
      a => !(a.album_id === albumId && a.image_uuid === imageId)
    )
    saveImageAlbums(associations)

    return Promise.resolve({ success: true })
  },

  /**
   * Get albums for an image
   */
  getAlbumsForImage(imageId, options = {}) {
    const { includeHidden = false } = options
    const associations = getImageAlbums()
    const albumIds = associations
      .filter(a => a.image_uuid === imageId)
      .map(a => a.album_id)

    let albums = getAlbums()
    albums = albums.filter(a => albumIds.includes(a.id))

    if (!includeHidden) {
      albums = albums.filter(a => !a.is_hidden)
    }

    const enriched = albums.map(enrichAlbum)
    return Promise.resolve({ data: enriched })
  },

  /**
   * Clear all album data (for demo reset)
   */
  clearAll() {
    localStorage.removeItem(ALBUMS_KEY)
    localStorage.removeItem(IMAGE_ALBUMS_KEY)
    return Promise.resolve()
  }
}
