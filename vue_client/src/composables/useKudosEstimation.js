import { ref } from 'vue'
import { imagesApi } from '../api/client.js'

/**
 * Composable for estimating kudos cost of image generation requests
 * Provides kudos estimation functionality with loading state management
 */
export function useKudosEstimation() {
  const kudosEstimate = ref(null)
  const estimating = ref(false)

  /**
   * Estimate kudos cost for a request
   * @param {Object} params - Request parameters matching AI Horde API format
   * @returns {Promise<number|null>} Estimated kudos cost or null if estimation failed
   */
  const estimateKudos = async (params) => {
    // Validate that we have a model
    if (!params || !params.models || params.models.length === 0) {
      kudosEstimate.value = null
      return null
    }

    try {
      estimating.value = true

      // Clone params to avoid mutation
      const estimateParams = JSON.parse(JSON.stringify(params))

      // Use placeholder prompt if user hasn't entered one yet
      if (!estimateParams.prompt || estimateParams.prompt.trim().length === 0) {
        estimateParams.prompt = 'placeholder prompt for estimation'
      }

      // Remove negative prompt for estimation if it's empty
      if (estimateParams.params?.negative_prompt && !estimateParams.params.negative_prompt.trim()) {
        delete estimateParams.params.negative_prompt
      }

      const response = await imagesApi.estimate(estimateParams)
      kudosEstimate.value = response.data.kudos
      return response.data.kudos
    } catch (error) {
      console.error('Error estimating kudos:', error)
      kudosEstimate.value = null
      return null
    } finally {
      estimating.value = false
    }
  }

  /**
   * Clear the current kudos estimate
   */
  const clearEstimate = () => {
    kudosEstimate.value = null
  }

  /**
   * Check if an estimate is available
   * @returns {boolean} True if estimate exists
   */
  const hasEstimate = () => {
    return kudosEstimate.value !== null
  }

  return {
    kudosEstimate,
    estimating,
    estimateKudos,
    clearEstimate,
    hasEstimate
  }
}
