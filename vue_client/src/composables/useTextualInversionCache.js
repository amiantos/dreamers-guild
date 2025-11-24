/**
 * useTextualInversionCache Composable
 *
 * Manages Textual Inversion search, caching, favorites, and recent TIs.
 * Provides a singleton pattern for shared state across components.
 */

import { ref, computed } from 'vue'
import { searchTextualInversions } from '../api/civitai'
import { settingsApi } from '../api/client'

// Shared state (singleton pattern)
const results = ref([])
const loading = ref(false)
const error = ref(null)
const currentPage = ref(1)
const currentSearchTerm = ref('')
const nextPageUrl = ref(null)
const baseModelFilters = ref([])
const nsfwEnabled = ref(false)
const sortOrder = ref('Highest Rated')

// Abort controller for canceling requests
let abortController = null
let searchTimeout = null

/**
 * Debounce helper
 */
function debounce(func, wait) {
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(searchTimeout)
      func(...args)
    }
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(later, wait)
  }
}

/**
 * Load base model filters from localStorage
 */
function loadFilters() {
  try {
    const saved = localStorage.getItem('tiBaseModelFilters')
    if (saved) {
      baseModelFilters.value = JSON.parse(saved)
    } else {
      // Default filters
      baseModelFilters.value = ['SD 1.x', 'SD 2.x', 'SDXL']
      saveFilters()
    }
  } catch (err) {
    console.error('Error loading filters:', err)
    baseModelFilters.value = ['SD 1.x', 'SD 2.x', 'SDXL']
  }
}

/**
 * Save base model filters to localStorage
 */
function saveFilters() {
  try {
    localStorage.setItem('tiBaseModelFilters', JSON.stringify(baseModelFilters.value))
  } catch (err) {
    console.error('Error saving filters:', err)
  }
}

/**
 * Perform search
 */
async function performSearch(query = '', url = null) {
  // Cancel any pending request
  if (abortController) {
    abortController.abort()
  }

  abortController = new AbortController()
  loading.value = true
  error.value = null

  try {
    const response = await searchTextualInversions({
      query,
      page: currentPage.value,
      baseModelFilters: baseModelFilters.value,
      nsfw: nsfwEnabled.value,
      sort: sortOrder.value,
      url,
      signal: abortController.signal
    })

    results.value = response.items
    nextPageUrl.value = response.metadata?.nextPage || null

    // Store current search term
    if (!url) {
      currentSearchTerm.value = query
    }

    return response
  } catch (err) {
    if (err.name !== 'AbortError') {
      error.value = err.message || 'Failed to fetch Textual Inversions'
      console.error('Search error:', err)
    }
    throw err
  } finally {
    loading.value = false
  }
}

/**
 * Debounced search function
 */
const debouncedSearch = debounce((query) => {
  currentPage.value = 1
  performSearch(query)
}, 500)

export function useTextualInversionCache() {
  // Initialize filters on first use
  if (baseModelFilters.value.length === 0) {
    loadFilters()
  }

  /**
   * Search for Textual Inversions
   */
  const search = (query = '') => {
    debouncedSearch(query)
  }

  /**
   * Immediate search (no debounce)
   */
  const searchImmediate = (query = '') => {
    currentPage.value = 1
    return performSearch(query)
  }

  /**
   * Go to next page
   */
  const goToNextPage = async () => {
    if (!nextPageUrl.value || loading.value) return

    // For searches (with query), use cursor-based pagination (no backwards navigation)
    // For browsing (no query), use page-based pagination (supports backwards)
    if (currentSearchTerm.value) {
      // Cursor-based: just increment page counter for display
      currentPage.value++
      await performSearch(currentSearchTerm.value, nextPageUrl.value)
    } else {
      // Page-based: traditional pagination
      currentPage.value++
      await performSearch('')
    }
  }

  /**
   * Go to previous page
   */
  const goToPreviousPage = async () => {
    if (currentPage.value <= 1 || loading.value) return

    // Cursor-based pagination (searches) doesn't support going backwards
    // Only allow backwards navigation for browsing (no search query)
    if (currentSearchTerm.value) {
      // For searches, cannot go back - would need to restart search
      console.warn('Backward pagination not supported for searches (cursor-based)')
      return
    }

    // Page-based browsing: normal backward pagination
    currentPage.value--
    await performSearch('')
  }

  /**
   * Update filters
   */
  const updateFilters = (filters, nsfw) => {
    baseModelFilters.value = filters
    nsfwEnabled.value = nsfw
    saveFilters()

    // Trigger new search with updated filters
    if (currentSearchTerm.value || results.value.length > 0) {
      currentPage.value = 1
      performSearch(currentSearchTerm.value)
    }
  }

  /**
   * Update sort order
   */
  const updateSort = (newSort) => {
    sortOrder.value = newSort

    // Trigger new search with updated sort
    if (currentSearchTerm.value || results.value.length > 0) {
      currentPage.value = 1
      performSearch(currentSearchTerm.value)
    }
  }

  /**
   * Reset search
   */
  const resetSearch = () => {
    currentPage.value = 1
    currentSearchTerm.value = ''
    nextPageUrl.value = null
    results.value = []
    error.value = null
  }

  // Computed properties
  const hasNextPage = computed(() => !!nextPageUrl.value)
  // Disable previous page for searches (cursor-based pagination doesn't support going backwards)
  const hasPreviousPage = computed(() => {
    if (currentSearchTerm.value) {
      // No backward pagination for searches (cursor-based)
      return false
    }
    // Normal backward pagination for browsing (page-based)
    return currentPage.value > 1
  })

  return {
    // State
    results,
    loading,
    error,
    currentPage,
    baseModelFilters,
    nsfwEnabled,
    sortOrder,

    // Computed
    hasNextPage,
    hasPreviousPage,

    // Methods
    search,
    searchImmediate,
    goToNextPage,
    goToPreviousPage,
    updateFilters,
    updateSort,
    resetSearch
  }
}

/**
 * Favorites Management
 * Using singleton pattern to share state across components
 */
// Shared state (singleton pattern)
const favorites = ref([])
const favoritesLoading = ref(false)
const favoritesError = ref(null)

export function useTextualInversionFavorites() {

  /**
   * Load favorites from settings API
   */
  const loadFavorites = async () => {
    favoritesLoading.value = true
    favoritesError.value = null

    try {
      const settings = await settingsApi.get()
      const favoriteTis = settings.favorite_tis || '[]'
      favorites.value = JSON.parse(favoriteTis)
    } catch (err) {
      favoritesError.value = err.message || 'Failed to load favorites'
      console.error('Error loading favorites:', err)
      favorites.value = []
    } finally {
      favoritesLoading.value = false
    }
  }

  /**
   * Save favorites to settings API
   */
  const saveFavorites = async (favoriteIds) => {
    try {
      await settingsApi.update({ favoriteTis: favoriteIds })
      favorites.value = favoriteIds
    } catch (err) {
      favoritesError.value = err.message || 'Failed to save favorites'
      console.error('Error saving favorites:', err)
      throw err
    }
  }

  /**
   * Toggle favorite
   */
  const toggleFavorite = async (tiId) => {
    const index = favorites.value.indexOf(tiId)
    let newFavorites

    if (index > -1) {
      // Remove from favorites
      newFavorites = [...favorites.value]
      newFavorites.splice(index, 1)
    } else {
      // Add to favorites
      newFavorites = [...favorites.value, tiId]
    }

    await saveFavorites(newFavorites)
  }

  /**
   * Check if a TI is favorited
   */
  const isFavorite = (tiId) => {
    return favorites.value.includes(tiId)
  }

  return {
    favorites,
    loading: favoritesLoading,
    error: favoritesError,
    loadFavorites,
    saveFavorites,
    toggleFavorite,
    isFavorite
  }
}

/**
 * Recent Textual Inversions Management
 */
export function useTextualInversionRecent() {
  const recent = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Load recent TIs from settings API
   */
  const loadRecent = async () => {
    loading.value = true
    error.value = null

    try {
      const settings = await settingsApi.get()
      const recentTis = settings.recent_tis || '[]'
      const parsed = JSON.parse(recentTis)

      // Sort by timestamp, newest first, limit to 20
      recent.value = parsed
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 20)
    } catch (err) {
      error.value = err.message || 'Failed to load recent Textual Inversions'
      console.error('Error loading recent TIs:', err)
      recent.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a TI to recent list
   * Only stores versionId + timestamp, full data hydrated from cache when displaying
   */
  const addToRecent = async (ti) => {
    try {
      const settings = await settingsApi.get()
      const recentTis = settings.recent_tis || '[]'
      let recentArray = JSON.parse(recentTis)

      // Remove if already exists
      recentArray = recentArray.filter(r => r.versionId !== ti.versionId)

      // Add to front (minimal data only)
      recentArray.unshift({
        versionId: ti.versionId,
        timestamp: Date.now()
      })

      // Keep last 20
      recentArray = recentArray.slice(0, 20)

      // Save
      await settingsApi.update({ recentTis: recentArray })
      recent.value = recentArray
    } catch (err) {
      error.value = err.message || 'Failed to add to recent'
      console.error('Error adding to recent:', err)
    }
  }

  /**
   * Add multiple TIs to recent
   */
  const addMultipleToRecent = async (tis) => {
    for (const ti of tis) {
      await addToRecent(ti)
    }
  }

  return {
    recent,
    loading,
    error,
    loadRecent,
    addToRecent,
    addMultipleToRecent
  }
}
