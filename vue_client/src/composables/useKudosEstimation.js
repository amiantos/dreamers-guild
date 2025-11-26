import { ref } from 'vue'
import { imagesApi } from '@api'

/**
 * Composable for estimating kudos cost of image generation requests
 * Provides kudos estimation functionality with loading state management
 */
export function useKudosEstimation() {
  const kudosEstimate = ref(null)
  const estimating = ref(false)
  const estimateError = ref(null)

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
      estimateError.value = null // Clear any previous error
      return response.data.kudos
    } catch (error) {
      console.error('Error estimating kudos:', error)
      kudosEstimate.value = null

      // Capture error message from API response
      if (error.response?.data?.message) {
        estimateError.value = error.response.data.message
      } else if (error.message) {
        estimateError.value = error.message
      } else {
        estimateError.value = 'Failed to estimate kudos cost'
      }

      return null
    } finally {
      estimating.value = false
    }
  }

  /**
   * Clear the current kudos estimate and error
   */
  const clearEstimate = () => {
    kudosEstimate.value = null
    estimateError.value = null
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
    estimateError,
    estimateKudos,
    clearEstimate,
    hasEstimate
  }
}
