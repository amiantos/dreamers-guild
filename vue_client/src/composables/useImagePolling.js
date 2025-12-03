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
 * @param {Function} options.onPollComplete - Callback after every poll cycle (for refreshing album counts, etc.)
 * @returns {Object} Polling controls and state
 */
export function useImagePolling({ filters, images, totalCount, currentView, currentAlbum, onNewImages, onPollComplete }) {
  let imagesPollInterval = null
  let finalImageCheckTimeout = null
  const wasActive = ref(false)

  /**
   * Check for new images and prepend them to the list
   */
  const checkNewImages = async () => {
    // Use currentAlbum as source of truth for album polling (not route-based currentView)
    // This prevents issues when ImageModal changes the route temporarily
    const albumId = currentAlbum?.value?.id
    const view = currentView?.value

    // Determine context for image fetching
    // Poll for library, album, and hidden views
    // Hidden view can get new images when generating to hidden albums
    // Favorites view doesn't get new images from generation (requires manual favoriting)
    const isAlbumContext = !!albumId
    const isLibraryContext = view === 'library' && !albumId
    const isHiddenContext = view === 'hidden' && !albumId
    const shouldFetchImages = isAlbumContext || isLibraryContext || isHiddenContext

    // Skip image fetching if searching or viewing specific request
    const hasFilters = filters.value.requestId || filters.value.keywords.length > 0

    try {
      // Only fetch images for library/album views without filters
      if (shouldFetchImages && !hasFilters) {
        let newImages = []
        let newTotal

        if (isAlbumContext) {
          // Fetch latest images for the current album
          const response = await albumsApi.getImages(albumId, 20, 0)
          newImages = response.data?.images || []
          newTotal = response.data?.total
        } else {
          // Build API options with view-specific flags
          const apiOptions = {
            ...filters.value,
            showHidden: isHiddenContext
          }
          const response = await imagesApi.getAll(20, 0, apiOptions)
          newImages = response.data?.data || []
          newTotal = response.data?.total
        }

        // Update total count if provided and changed
        if (totalCount && newTotal !== undefined && newTotal !== totalCount.value) {
          totalCount.value = newTotal
        }

        if (newImages.length > 0) {
          // Find images we don't have yet
          const existingIds = new Set(images.value.map(img => img.uuid))
          const trulyNewImages = newImages.filter(img => !existingIds.has(img.uuid))

          if (trulyNewImages.length > 0) {
            // Prepend new images to the list
            images.value = [...trulyNewImages, ...images.value]

            // Notify callback if provided
            if (onNewImages) {
              onNewImages(trulyNewImages)
            }
          }
        }
      }

      // Always notify poll complete (for refreshing album counts, etc.)
      // This runs regardless of current view so album sidebar stays updated
      if (onPollComplete) {
        onPollComplete()
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
    imagesPollInterval = setInterval(checkNewImages, interval)
  }

  /**
   * Stop polling for new images
   */
  const stopPolling = () => {
    if (imagesPollInterval) {
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
    finalImageCheckTimeout = setTimeout(() => {
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
