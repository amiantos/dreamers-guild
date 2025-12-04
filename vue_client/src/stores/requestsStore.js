import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { requestsApi } from '@api'

/**
 * Requests Store - Centralized state management for image generation requests
 * Handles request queue, polling, and deletion
 */
export const useRequestsStore = defineStore('requests', () => {
  // State
  const requests = ref([])
  const queueStatus = ref(null)
  const loading = ref(false)

  // Delete modal state
  const requestToDelete = ref(null)
  const deleteModalVisible = ref(false)
  const deleteAllModalVisible = ref(false)
  const isDeleting = ref(false)

  // Polling
  let pollInterval = null

  // Computed
  const deletableRequests = computed(() => {
    return requests.value.filter(r => r.status === 'completed' || r.status === 'failed')
  })

  const hasActiveRequests = computed(() => {
    return requests.value.some(r => r.status === 'pending' || r.status === 'processing')
  })

  const requestCount = computed(() => requests.value.length)

  /**
   * Fetch all requests from API
   */
  const fetchRequests = async () => {
    try {
      const response = await requestsApi.getAll()
      requests.value = response.data
    } catch (error) {
      console.error('Error fetching requests:', error)
    }
  }

  /**
   * Fetch queue status from API
   */
  const fetchQueueStatus = async () => {
    try {
      const response = await requestsApi.getQueueStatus()
      queueStatus.value = response.data
    } catch (error) {
      console.error('Error fetching queue status:', error)
    }
  }

  /**
   * Show delete modal for a specific request
   * @param {Object} request - Request to delete
   */
  const showDeleteModal = (request) => {
    // For failed requests, auto-prune without confirmation
    if (request.status === 'failed') {
      requestToDelete.value = request
      confirmDelete('prune')
      return
    }

    requestToDelete.value = request
    deleteModalVisible.value = true
  }

  /**
   * Show delete all modal
   */
  const showDeleteAllModal = () => {
    deleteAllModalVisible.value = true
  }

  /**
   * Close delete modal
   */
  const closeDeleteModal = () => {
    deleteModalVisible.value = false
    requestToDelete.value = null
  }

  /**
   * Close delete all modal
   */
  const closeDeleteAllModal = () => {
    deleteAllModalVisible.value = false
  }

  /**
   * Confirm and execute delete for single request
   * @param {string} imageAction - 'delete' or 'prune' (keep images)
   */
  const confirmDelete = async (imageAction) => {
    if (!requestToDelete.value) return

    isDeleting.value = true
    try {
      await requestsApi.delete(requestToDelete.value.uuid, imageAction)
      requests.value = requests.value.filter(r => r.uuid !== requestToDelete.value.uuid)
      closeDeleteModal()
    } catch (error) {
      console.error('Error deleting request:', error)
      throw error
    } finally {
      isDeleting.value = false
    }
  }

  /**
   * Confirm and execute delete for all deletable requests
   * @param {string} imageAction - 'delete' or 'prune' (keep images)
   */
  const confirmDeleteAll = async (imageAction) => {
    const requestsToDelete = deletableRequests.value
    if (requestsToDelete.length === 0) return

    isDeleting.value = true
    try {
      for (const request of requestsToDelete) {
        await requestsApi.delete(request.uuid, imageAction)
      }
      requests.value = requests.value.filter(r => !requestsToDelete.find(d => d.uuid === r.uuid))
      closeDeleteAllModal()
    } catch (error) {
      console.error('Error deleting requests:', error)
      throw error
    } finally {
      isDeleting.value = false
    }
  }

  /**
   * Retry a failed request
   * @param {string} requestId - UUID of request to retry
   * @returns {Object} New request data
   */
  const retryRequest = async (requestId) => {
    try {
      const response = await requestsApi.retry(requestId)
      // The failed request is deleted and a new one created
      requests.value = requests.value.filter(r => r.uuid !== requestId)
      requests.value.unshift(response.data.request)
      return response.data
    } catch (error) {
      console.error('Error retrying request:', error)
      throw error
    }
  }

  /**
   * Start polling for requests and queue status
   * @param {number} interval - Polling interval in milliseconds (default 2000)
   */
  const startPolling = (interval = 2000) => {
    if (pollInterval) return // Already polling

    // Initial fetch
    fetchRequests()
    fetchQueueStatus()

    pollInterval = setInterval(() => {
      fetchRequests()
      fetchQueueStatus()
    }, interval)
  }

  /**
   * Stop polling
   */
  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  /**
   * Clear all state
   */
  const clearState = () => {
    stopPolling()
    requests.value = []
    queueStatus.value = null
    requestToDelete.value = null
    deleteModalVisible.value = false
    deleteAllModalVisible.value = false
  }

  return {
    // State
    requests,
    queueStatus,
    loading,
    requestToDelete,
    deleteModalVisible,
    deleteAllModalVisible,
    isDeleting,
    // Computed
    deletableRequests,
    hasActiveRequests,
    requestCount,
    // Actions
    fetchRequests,
    fetchQueueStatus,
    showDeleteModal,
    showDeleteAllModal,
    closeDeleteModal,
    closeDeleteAllModal,
    confirmDelete,
    confirmDeleteAll,
    retryRequest,
    startPolling,
    stopPolling,
    clearState
  }
})
