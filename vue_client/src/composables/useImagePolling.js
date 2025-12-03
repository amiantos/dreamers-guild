import { ref, watch } from 'vue'
import { imagesApi, albumsApi } from '@api'

/**
 * Composable for polling new images based on queue status
 * Manages automatic image refresh when requests are being processed
 *
 * @param {Object} options - Configuration options
 * @param {import('vue').Ref} options.filters - Filters ref for image queries
 * @param {import('vue').Ref} options.images - Images ref to update with new images
 * @param {import('vue').Ref} options.totalCount - Total count ref to update
 * @param {import('vue').Ref} options.currentView - Current view ref (library, album, favorites, etc.)
 * @param {import('vue').Ref} options.currentAlbum - Current album ref (for album view)
 * @param {Function} options.onNewImages - Callback when new images are added
 * @returns {Object} Polling controls and state
 */
export function useImagePolling({ filters, images, totalCount, currentView, currentAlbum, onNewImages }) {
  let imagesPollInterval = null
  let finalImageCheckTimeout = null
  const wasActive = ref(false)

  /**
   * Check for new images and prepend them to the list
   */
  const checkNewImages = async () => {
    // Only poll for library and album views
    // Favorites and hidden views don't get new images from generation
    const view = currentView?.value
    if (view !== 'library' && view !== 'album') {
      return
    }

    // For album view, we need a current album
    if (view === 'album' && !currentAlbum?.value?.id) {
      return
    }

    // Don't check for new images if we're viewing a specific request or searching
    if (filters.value.requestId || filters.value.keywords.length > 0) {
      return
    }

    try {
      let newImages = []
      let newTotal

      if (view === 'album') {
        // Fetch latest images for the current album
        const response = await albumsApi.getImages(currentAlbum.value.id, 20, 0)
        newImages = response.data?.images || []
        newTotal = response.data?.total
      } else {
        // Fetch the latest images with current filters applied
        const response = await imagesApi.getAll(20, 0, filters.value)
        newImages = response.data?.data || []
        newTotal = response.data?.total
      }

      // Update total count if provided and changed
      if (totalCount && newTotal !== undefined && newTotal !== totalCount.value) {
        totalCount.value = newTotal
      }

      if (newImages.length === 0) return

      // Find images we don't have yet
      const existingIds = new Set(images.value.map(img => img.uuid))
      const trulyNewImages = newImages.filter(img => !existingIds.has(img.uuid))

      if (trulyNewImages.length > 0) {
        // Prepend new images to the list
        images.value = [...trulyNewImages, ...images.value]
        console.log(`Added ${trulyNewImages.length} new image(s) to ${view}`)

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
