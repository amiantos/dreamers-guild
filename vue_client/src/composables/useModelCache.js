import { ref } from 'vue'
import axios from 'axios'

// Shared state across all instances (singleton pattern)
const models = ref([])
const loading = ref(false)
const error = ref(null)
const lastFetched = ref(null)

const CACHE_KEY = 'aiHordeModels'
const CACHE_TIME_KEY = 'aiHordeModelsTime'
const CACHE_MAX_AGE = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Composable for managing AI Horde model cache
 * Provides centralized model fetching with localStorage caching
 * Shared state ensures all components use the same model data
 */
export function useModelCache() {
  /**
   * Fetch models from AI Horde API with caching
   * @param {boolean} forceRefresh - Skip cache and fetch fresh data
   * @returns {Promise<Array>} Array of model objects
   */
  const fetchModels = async (forceRefresh = false) => {
    try {
      loading.value = true
      error.value = null

      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedModels = localStorage.getItem(CACHE_KEY)
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY)

        if (cachedModels && cachedTime) {
          const age = Date.now() - parseInt(cachedTime)
          if (age < CACHE_MAX_AGE) {
            // Use cached models
            try {
              models.value = JSON.parse(cachedModels)
              lastFetched.value = parseInt(cachedTime)
              loading.value = false
              return models.value
            } catch (parseError) {
              console.error('Error parsing cached models:', parseError)
              // Fall through to fetch from server
            }
          }
        }
      }

      // Fetch from server
      const response = await axios.get('https://stablehorde.net/api/v2/status/models')

      // Filter to only active text-to-image models and sort by count (popularity)
      models.value = response.data
        .filter(model => model.type === 'image' && model.count > 0)
        .sort((a, b) => b.count - a.count)

      // Cache the models
      const now = Date.now()
      localStorage.setItem(CACHE_KEY, JSON.stringify(models.value))
      localStorage.setItem(CACHE_TIME_KEY, now.toString())
      lastFetched.value = now

      return models.value
    } catch (err) {
      console.error('Error fetching models:', err)
      error.value = err
      models.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear the model cache
   */
  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIME_KEY)
    models.value = []
    lastFetched.value = null
  }

  /**
   * Get the most popular model (first in sorted list)
   * @returns {Object|null} The most popular model or null if no models
   */
  const getMostPopularModel = () => {
    return models.value.length > 0 ? models.value[0] : null
  }

  /**
   * Check if cache is stale
   * @returns {boolean} True if cache should be refreshed
   */
  const isCacheStale = () => {
    if (!lastFetched.value) return true
    const age = Date.now() - lastFetched.value
    return age >= CACHE_MAX_AGE
  }

  return {
    models,
    loading,
    error,
    lastFetched,
    fetchModels,
    clearCache,
    getMostPopularModel,
    isCacheStale
  }
}
