import { ref, watch } from 'vue'
import { imagesApi } from '../api/client.js'

/**
 * Composable for polling new images based on queue status
 * Manages automatic image refresh when requests are being processed
 *
 * @param {Object} options - Configuration options
 * @param {import('vue').Ref} options.filters - Filters ref for image queries
 * @param {import('vue').Ref} options.images - Images ref to update with new images
 * @param {Function} options.onNewImages - Callback when new images are added
 * @returns {Object} Polling controls and state
 */
export function useImagePolling({ filters, images, onNewImages }) {
  let imagesPollInterval = null
  let finalImageCheckTimeout = null
  const wasActive = ref(false)

  /**
   * Check for new images and prepend them to the list
   */
  const checkNewImages = async () => {
    // Don't check for new images if we're viewing a specific request or searching
    if (filters.value.requestId || filters.value.keywords.length > 0) {
      return
    }

    try {
      // Fetch the latest images with current filters applied
      const response = await imagesApi.getAll(20, 0, filters.value)
      // Backend returns { data: images, total }, axios wraps it in response.data
      const newImages = (response.data && response.data.data) ? response.data.data : []

      if (newImages.length === 0) return

      // Find images we don't have yet
      const existingIds = new Set(images.value.map(img => img.uuid))
      const trulyNewImages = newImages.filter(img => !existingIds.has(img.uuid))

      if (trulyNewImages.length > 0) {
        // Prepend new images to the list
        images.value = [...trulyNewImages, ...images.value]
        console.log(`Added ${trulyNewImages.length} new image(s) to library`)

        // Notify callback if provided
        if (onNewImages) {
          onNewImages(trulyNewImages)
        }
      }
    } catch (error) {
      console.error('Error checking for new images:', error)
    }
  }

  /**
   * Start polling for new images
   * @param {number} interval - Polling interval in milliseconds (default: 3000)
   */
  const startPolling = (interval = 3000) => {
    if (imagesPollInterval) return // Already polling

    console.log('Starting image polling (active requests detected)')
    imagesPollInterval = setInterval(checkNewImages, interval)
  }

  /**
   * Stop polling for new images
   */
  const stopPolling = () => {
    if (imagesPollInterval) {
      console.log('Stopping image polling (no active requests)')
      clearInterval(imagesPollInterval)
      imagesPollInterval = null
    }
  }

  /**
   * Schedule a final check for new images
   * Used when queue becomes idle to catch any remaining images
   * @param {number} delay - Delay before final check in milliseconds (default: 3000)
   */
  const scheduleFinalCheck = (delay = 3000) => {
    console.log('Queue became idle, scheduling final image check in 3 seconds...')
    finalImageCheckTimeout = setTimeout(() => {
      console.log('Running final image check')
      checkNewImages()
      wasActive.value = false
      finalImageCheckTimeout = null
    }, delay)
  }

  /**
   * Clear any scheduled final check
   */
  const clearFinalCheck = () => {
    if (finalImageCheckTimeout) {
      clearTimeout(finalImageCheckTimeout)
      finalImageCheckTimeout = null
    }
  }

  /**
   * Handle queue status changes to start/stop polling
   * @param {import('vue').Ref} queueStatus - Queue status ref to watch
   */
  const watchQueueStatus = (queueStatus) => {
    return watch(queueStatus, (newStatus) => {
      if (!newStatus) return

      const hasActivity = newStatus.active > 0 || newStatus.pendingRequests > 0

      if (hasActivity) {
        // Clear any pending final check if we become active again
        clearFinalCheck()
        startPolling()
        wasActive.value = true
      } else {
        stopPolling()

        // If we were active and now we're idle, schedule a final check
        // to catch any images that were still being saved
        if (wasActive.value) {
          scheduleFinalCheck()
        }
      }
    })
  }

  /**
   * Clean up polling intervals and timeouts
   */
  const cleanup = () => {
    stopPolling()
    clearFinalCheck()
  }

  return {
    wasActive,
    checkNewImages,
    startPolling,
    stopPolling,
    scheduleFinalCheck,
    clearFinalCheck,
    watchQueueStatus,
    cleanup
  }
}
