import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { albumsApi } from '@api'

/**
 * Album Store - Centralized state management for albums
 * Provides single source of truth for album data across components
 */
export const useAlbumStore = defineStore('albums', () => {
  // State
  const albums = ref([])
  const currentAlbum = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const visibleAlbums = computed(() => {
    return albums.value.filter(album => !album.is_hidden)
  })

  const albumCount = computed(() => albums.value.length)

  /**
   * Load all albums from API
   * @param {boolean} includeHidden - Include hidden albums
   */
  const loadAlbums = async (includeHidden = false) => {
    loading.value = true
    error.value = null

    try {
      const response = await albumsApi.getAll({ includeHidden })
      albums.value = response.data || []
    } catch (err) {
      console.error('Error loading albums:', err)
      error.value = 'Failed to load albums'
    } finally {
      loading.value = false
    }
  }

  /**
   * Get album by slug
   * @param {string} slug - Album slug
   * @returns {Object|null} Album or null
   */
  const getAlbumBySlug = (slug) => {
    return albums.value.find(a => a.slug === slug) || null
  }

  /**
   * Get album by ID
   * @param {number} id - Album ID
   * @returns {Object|null} Album or null
   */
  const getAlbumById = (id) => {
    return albums.value.find(a => a.id === id) || null
  }

  /**
   * Set current album (for album view)
   * @param {Object|null} album - Album to set as current
   */
  const setCurrentAlbum = (album) => {
    currentAlbum.value = album
  }

  /**
   * Load and set current album by slug
   * @param {string} slug - Album slug
   */
  const loadCurrentAlbum = async (slug) => {
    // First try to find in local state
    let album = getAlbumBySlug(slug)

    // If not found, fetch from API
    if (!album) {
      try {
        const response = await albumsApi.getBySlug(slug)
        album = response.data
        // Update local state
        const index = albums.value.findIndex(a => a.id === album.id)
        if (index > -1) {
          albums.value[index] = album
        } else {
          albums.value.push(album)
        }
      } catch (err) {
        console.error('Error loading album:', err)
        album = null
      }
    }

    currentAlbum.value = album
    return album
  }

  /**
   * Create a new album
   * @param {Object} data - Album data { title, isHidden }
   * @returns {Object} Created album
   */
  const createAlbum = async (data) => {
    const response = await albumsApi.create(data)
    const newAlbum = { ...response.data, count: 0, thumbnail: null, type: 'user' }
    albums.value.unshift(newAlbum)
    return newAlbum
  }

  /**
   * Update an album
   * @param {number} id - Album ID
   * @param {Object} data - Update data
   * @returns {Object} Updated album
   */
  const updateAlbum = async (id, data) => {
    const response = await albumsApi.update(id, data)
    const updated = response.data
    const index = albums.value.findIndex(a => a.id === id)
    if (index > -1) {
      // Preserve count and thumbnail from previous state
      albums.value[index] = {
        ...albums.value[index],
        ...updated
      }
    }
    // Update current album if it's the one being edited
    if (currentAlbum.value?.id === id) {
      currentAlbum.value = { ...currentAlbum.value, ...updated }
    }
    return updated
  }

  /**
   * Delete an album
   * @param {number} id - Album ID
   */
  const deleteAlbum = async (id) => {
    await albumsApi.delete(id)
    albums.value = albums.value.filter(a => a.id !== id)
    if (currentAlbum.value?.id === id) {
      currentAlbum.value = null
    }
  }

  /**
   * Update album count (after adding/removing images)
   * @param {number} albumId - Album ID
   * @param {number} delta - Change in count (+/-)
   */
  const updateAlbumCount = (albumId, delta) => {
    const album = albums.value.find(a => a.id === albumId)
    if (album) {
      album.count = Math.max(0, (album.count || 0) + delta)
    }
    if (currentAlbum.value?.id === albumId) {
      currentAlbum.value.count = Math.max(0, (currentAlbum.value.count || 0) + delta)
    }
  }

  /**
   * Set album thumbnail
   * @param {number} albumId - Album ID
   * @param {string} thumbnailUuid - Image UUID for thumbnail
   */
  const setAlbumThumbnail = (albumId, thumbnailUuid) => {
    const album = albums.value.find(a => a.id === albumId)
    if (album) {
      album.thumbnail = thumbnailUuid
    }
    if (currentAlbum.value?.id === albumId) {
      currentAlbum.value.thumbnail = thumbnailUuid
    }
  }

  /**
   * Refresh album data (count and thumbnail) from API
   * @param {number} albumId - Album ID
   */
  const refreshAlbum = async (albumId) => {
    const album = albums.value.find(a => a.id === albumId)
    if (!album) return

    try {
      const response = await albumsApi.getBySlug(album.slug)
      const updated = response.data
      const index = albums.value.findIndex(a => a.id === albumId)
      if (index > -1) {
        albums.value[index] = { ...albums.value[index], ...updated }
      }
      if (currentAlbum.value?.id === albumId) {
        currentAlbum.value = { ...currentAlbum.value, ...updated }
      }
    } catch (err) {
      console.error('Error refreshing album:', err)
    }
  }

  /**
   * Clear all album state
   */
  const clearState = () => {
    albums.value = []
    currentAlbum.value = null
    error.value = null
  }

  return {
    // State
    albums,
    currentAlbum,
    loading,
    error,
    // Computed
    visibleAlbums,
    albumCount,
    // Actions
    loadAlbums,
    getAlbumBySlug,
    getAlbumById,
    setCurrentAlbum,
    loadCurrentAlbum,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    updateAlbumCount,
    setAlbumThumbnail,
    refreshAlbum,
    clearState
  }
})
