<template>
  <div class="requests-view">
    <div class="header">
      <h2>Requests</h2>
      <div class="queue-status" v-if="queueStatus">
        <span class="status-dot" :class="{ active: queueStatus.isProcessing }"></span>
        <span>{{ queueStatus.active }}/{{ queueStatus.maxActive }} active</span>
        <span class="divider">•</span>
        <span>{{ queueStatus.pendingRequests }} pending</span>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading requests...</div>

    <div v-else-if="requests.length === 0" class="empty-state">
      <p>No requests yet</p>
      <p class="hint">Click "New Request" to generate your first AI image</p>
    </div>

    <div v-else>
      <div class="requests-grid">
        <RequestCard
          v-for="request in requests"
          :key="request.uuid"
          :request="request"
          @view-images="viewRequestImages"
          @delete="showDeleteModal"
        />
      </div>

      <!-- Floating action button for delete all -->
      <button
        @click="showDeleteAllModal"
        class="fab-delete-all"
        title="Delete all requests"
      >
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>

    <DeleteRequestModal
      v-if="deleteModalVisible"
      @close="deleteModalVisible = false"
      @delete="confirmDelete"
    />

    <DeleteAllRequestsModal
      v-if="deleteAllModalVisible"
      :requests="requests"
      @close="deleteAllModalVisible = false"
      @delete="confirmDeleteAll"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { requestsApi } from '../api/client.js'
import RequestCard from '../components/RequestCard.vue'
import DeleteRequestModal from '../components/DeleteRequestModal.vue'
import DeleteAllRequestsModal from '../components/DeleteAllRequestsModal.vue'

export default {
  name: 'RequestsView',
  components: {
    RequestCard,
    DeleteRequestModal,
    DeleteAllRequestsModal
  },
  setup() {
    const router = useRouter()
    const requests = ref([])
    const queueStatus = ref(null)
    const loading = ref(true)
    const deleteModalVisible = ref(false)
    const deleteAllModalVisible = ref(false)
    const requestToDelete = ref(null)
    let pollInterval = null

    const fetchRequests = async () => {
      try {
        const response = await requestsApi.getAll()
        requests.value = response.data
      } catch (error) {
        console.error('Error fetching requests:', error)
      } finally {
        loading.value = false
      }
    }

    const fetchQueueStatus = async () => {
      try {
        const response = await requestsApi.getQueueStatus()
        queueStatus.value = response.data
      } catch (error) {
        console.error('Error fetching queue status:', error)
      }
    }

    const viewRequestImages = (requestId) => {
      // Set the request filter in localStorage
      const filters = {
        requestId: requestId,
        keywords: null
      }
      localStorage.setItem('libraryFilters', JSON.stringify(filters))

      // Navigate to library (LibraryView will pick up the filter)
      router.push('/library')
    }

    const showDeleteModal = (requestId) => {
      requestToDelete.value = requestId
      deleteModalVisible.value = true
    }

    const confirmDelete = async (imageAction) => {
      if (!requestToDelete.value) return

      try {
        await requestsApi.delete(requestToDelete.value, imageAction)
        requests.value = requests.value.filter(r => r.uuid !== requestToDelete.value)
        deleteModalVisible.value = false
        requestToDelete.value = null
      } catch (error) {
        console.error('Error deleting request:', error)
        alert('Failed to delete request. Please try again.')
      }
    }

    const showDeleteAllModal = () => {
      deleteAllModalVisible.value = true
    }

    const confirmDeleteAll = async (imageAction) => {
      try {
        await requestsApi.deleteAll(imageAction)
        requests.value = []
        deleteAllModalVisible.value = false
      } catch (error) {
        console.error('Error deleting all requests:', error)
        alert('Failed to delete all requests. Please try again.')
      }
    }

    onMounted(() => {
      fetchRequests()
      fetchQueueStatus()

      // Poll for updates every 2 seconds
      pollInterval = setInterval(() => {
        fetchRequests()
        fetchQueueStatus()
      }, 2000)
    })

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    })

    return {
      requests,
      queueStatus,
      loading,
      deleteModalVisible,
      deleteAllModalVisible,
      viewRequestImages,
      showDeleteModal,
      showDeleteAllModal,
      confirmDelete,
      confirmDeleteAll
    }
  }
}
</script>

<style scoped>
.requests-view {
  padding: 1rem 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 2rem;
  font-weight: 600;
}

.queue-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #999;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
}

.status-dot.active {
  background: #00ff00;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.divider {
  color: #444;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

.empty-state p {
  margin-bottom: 0.5rem;
}

.empty-state .hint {
  font-size: 0.9rem;
  color: #555;
}

.requests-grid {
  display: grid;
  gap: 1rem;
}

.fab-delete-all {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #999;
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.fab-delete-all:hover {
  background: #3a3a3a;
  border-color: #ff6b6b;
  color: #ff6b6b;
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.fab-delete-all:active {
  transform: scale(0.95);
}
</style>
