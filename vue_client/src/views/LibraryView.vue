<template>
  <div class="library-view" :class="{ 'panel-open': isPanelOpen }">
    <!-- Requests Panel -->
    <div class="requests-panel" :class="{ open: isPanelOpen }">
      <div class="panel-content">
        <div v-if="requests.length === 0" class="panel-empty-state">
          <p>No requests yet</p>
          <p class="hint">Click the + button to generate your first AI image</p>
        </div>

        <div v-else class="requests-grid">
          <RequestCard
            v-for="request in requests"
            :key="request.uuid"
            :request="request"
            @view-images="viewRequestImages"
            @delete="showDeleteModal"
          />
        </div>
      </div>
    </div>

    <DeleteRequestModal
      v-if="deleteModalVisible"
      @close="deleteModalVisible = false"
      @delete="confirmDelete"
    />

    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <h2>Aislingeach</h2>
        </div>

        <div class="header-controls">
          <div class="right-controls">
            <!-- Active Filters -->
            <div v-if="filters.requestId || filters.keywords" class="filter-chips">
              <div v-if="filters.requestId" class="filter-chip">
                <span>Request: {{ filters.requestId.substring(0, 8) }}</span>
                <button @click="clearFilter('requestId')" class="chip-remove">×</button>
              </div>
              <div v-if="filters.keywords" class="filter-chip">
                <span>{{ filters.keywords }}</span>
                <button @click="clearFilter('keywords')" class="chip-remove">×</button>
              </div>
            </div>

            <!-- Filter Buttons -->
            <div class="filter-buttons">
              <button
                @click="toggleFavoritesFilter"
                :class="['btn-filter', { active: filters.showFavoritesOnly }]"
                title="Show favorites only"
              >
                ★ Favorites
              </button>
              <button
                @click="toggleHiddenFilter"
                :class="['btn-filter', { active: filters.showHidden }]"
                title="Show hidden images"
              >
                👁 Hidden
              </button>
            </div>

            <!-- Search Bar -->
            <div class="search-bar">
              <input
                type="text"
                v-model="searchQuery"
                @keyup.enter="applySearch"
                placeholder="Search images..."
                class="search-input"
              />
              <button @click="applySearch" class="btn-search">Search</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Requests Panel Toggle Tab (inside header) -->
      <div class="panel-tab" @click="togglePanel" :class="{ open: isPanelOpen }">
        <div class="tab-content">
          <span class="status-dot" :class="requestStatusClass"></span>
          <span class="tab-text">Requests</span>
        </div>
      </div>
    </div>

    <div v-if="loading && images.length === 0" class="loading">
      Loading images...
    </div>

    <div v-else-if="images.length === 0" class="empty-state">
      <p>No images found</p>
      <p class="hint">Try adjusting your filters or generate some images</p>
    </div>

    <div v-else class="image-grid" ref="gridContainer">
      <div
        v-for="image in images"
        :key="image.uuid"
        class="image-item"
        @click="viewImage(image)"
      >
        <img
          :src="getThumbnailUrl(image.uuid)"
          :alt="image.prompt_simple"
          loading="lazy"
        />
        <div v-if="image.is_favorite" class="favorite-badge" title="Favorited">
          ★
        </div>
        <div class="image-overlay">
          <div class="image-info">
            <span class="date">{{ formatDate(image.date_created) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading && images.length > 0" class="loading-more">
      Loading more...
    </div>

    <ImageModal
      v-if="selectedImage"
      :image="selectedImage"
      :images="images"
      :currentIndex="currentImageIndex"
      @close="closeImage"
      @delete="deleteImage"
      @navigate="navigateImage"
      @load-settings="handleLoadSettings"
      @update="handleImageUpdate"
    />

    <!-- Floating Action Button (Settings) -->
    <button @click="openSettings" class="fab fab-settings" title="Settings">
      ⚙
    </button>

    <!-- Floating Action Button (New Request) -->
    <button @click="openNewRequest" class="fab fab-new" title="New Request">
      +
    </button>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { imagesApi, requestsApi } from '../api/client.js'
import ImageModal from '../components/ImageModal.vue'
import RequestCard from '../components/RequestCard.vue'
import DeleteRequestModal from '../components/DeleteRequestModal.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal,
    RequestCard,
    DeleteRequestModal
  },
  props: {
    imageId: String // selected image ID from URL
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    const images = ref([])
    const loading = ref(true)
    const selectedImage = ref(null)
    const gridContainer = ref(null)
    const hasMore = ref(true)
    const offset = ref(0)
    const limit = 50
    const searchQuery = ref('')
    const filters = ref({
      requestId: null,
      keywords: null,
      showFavoritesOnly: false,
      showHidden: false
    })

    // Requests panel state
    const isPanelOpen = ref(false)
    const requests = ref([])
    const queueStatus = ref(null)
    const deleteModalVisible = ref(false)
    const requestToDelete = ref(null)
    let pollInterval = null
    let imagesPollInterval = null
    let finalImageCheckTimeout = null
    const wasActive = ref(false)

    // Inject functions from App.vue
    const loadSettingsFromImage = inject('loadSettingsFromImage')
    const openSettingsModal = inject('openSettingsModal')
    const openRequestModal = inject('openRequestModal')
    const shouldOpenRequestsPanel = inject('shouldOpenRequestsPanel')

    const openSettings = () => {
      if (openSettingsModal) {
        openSettingsModal()
      }
    }

    const openNewRequest = () => {
      if (openRequestModal) {
        openRequestModal()
      }
    }

    // Load filters from localStorage - removed, filters reset on page load
    const loadFilters = () => {
      // Filters no longer persist across page loads
    }

    // Save filters to localStorage - removed
    const saveFilters = () => {
      // Filters no longer persist across page loads
    }

    const currentImageIndex = computed(() => {
      if (!selectedImage.value) return -1
      return images.value.findIndex(img => img.uuid === selectedImage.value.uuid)
    })

    const fetchImages = async (append = false) => {
      if (!hasMore.value && append) return

      try {
        loading.value = true
        let response

        if (filters.value.requestId) {
          response = await imagesApi.getByRequestId(filters.value.requestId, limit)
          hasMore.value = false // Request images don't paginate
        } else if (filters.value.keywords) {
          response = await imagesApi.search(filters.value.keywords, limit, filters.value)
          hasMore.value = false // Search doesn't paginate yet
        } else {
          response = await imagesApi.getAll(limit, offset.value, filters.value)
        }

        const newImages = response.data

        if (append) {
          images.value = [...images.value, ...newImages]
        } else {
          images.value = newImages
        }

        if (newImages.length < limit) {
          hasMore.value = false
        } else {
          offset.value += limit
        }
      } catch (error) {
        console.error('Error fetching images:', error)
      } finally {
        loading.value = false
      }
    }

    const handleScroll = () => {
      if (!gridContainer.value || loading.value || !hasMore.value) return

      const container = gridContainer.value
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      // Load more when scrolled near bottom
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        fetchImages(true)
      }
    }

    const getThumbnailUrl = (imageId) => {
      return imagesApi.getThumbnailUrl(imageId)
    }

    const formatDate = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleDateString()
    }

    const viewImage = (image) => {
      selectedImage.value = image
      updateUrl(image.uuid)
    }

    const closeImage = () => {
      selectedImage.value = null
      router.replace('/')
    }

    const setFilter = (filterType, value) => {
      filters.value[filterType] = value
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const clearFilter = (filterType) => {
      filters.value[filterType] = null
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const applySearch = () => {
      if (searchQuery.value.trim()) {
        setFilter('keywords', searchQuery.value.trim())
      }
    }

    const clearAllFilters = () => {
      filters.value.requestId = null
      filters.value.keywords = null
      filters.value.showFavoritesOnly = false
      filters.value.showHidden = false
      searchQuery.value = ''
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const toggleFavoritesFilter = () => {
      filters.value.showFavoritesOnly = !filters.value.showFavoritesOnly
      // If enabling favorites, disable hidden
      if (filters.value.showFavoritesOnly) {
        filters.value.showHidden = false
      }
      // Refetch images with new filter
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const toggleHiddenFilter = () => {
      filters.value.showHidden = !filters.value.showHidden
      // If enabling hidden, disable favorites
      if (filters.value.showHidden) {
        filters.value.showFavoritesOnly = false
      }
      // Refetch images with new filter
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const navigateImage = (direction) => {
      const currentIndex = currentImageIndex.value
      let newIndex = currentIndex + direction

      // Wrap around
      if (newIndex < 0) newIndex = images.value.length - 1
      if (newIndex >= images.value.length) newIndex = 0

      const newImage = images.value[newIndex]
      if (newImage) {
        selectedImage.value = newImage
        updateUrl(newImage.uuid)
      }
    }

    const updateUrl = (imageId) => {
      // Always use canonical image URL
      // Use push for first image view, replace for navigation between images
      if (!selectedImage.value) {
        router.push(`/image/${imageId}`)
      } else {
        router.replace(`/image/${imageId}`)
      }
    }

    const deleteImage = async (imageId) => {
      if (!confirm('Delete this image?')) return

      try {
        await imagesApi.delete(imageId)
        images.value = images.value.filter(img => img.uuid !== imageId)
        selectedImage.value = null
      } catch (error) {
        console.error('Error deleting image:', error)
      }
    }

    const handleLoadSettings = (includeSeed) => {
      if (selectedImage.value && loadSettingsFromImage) {
        loadSettingsFromImage(selectedImage.value, includeSeed)
      }
    }

    const handleImageUpdate = (updates) => {
      // Update the image in the images array
      const imageIndex = images.value.findIndex(img => img.uuid === updates.uuid)
      if (imageIndex !== -1) {
        images.value[imageIndex] = { ...images.value[imageIndex], ...updates }
      }
    }

    // Load image from URL if imageId prop is present
    const loadImageFromUrl = async () => {
      if (props.imageId && images.value.length > 0) {
        const image = images.value.find(img => img.uuid === props.imageId)
        if (image) {
          selectedImage.value = image
        } else {
          // Image not in current list, try to fetch it
          try {
            const response = await imagesApi.getById(props.imageId)
            selectedImage.value = response.data
          } catch (error) {
            console.error('Error loading image from URL:', error)
          }
        }
      }
    }

    // Watch for imageId changes from URL
    watch(() => props.imageId, () => {
      if (props.imageId) {
        loadImageFromUrl()
      } else {
        selectedImage.value = null
      }
    })

    // Requests panel functions
    const togglePanel = () => {
      isPanelOpen.value = !isPanelOpen.value
    }

    const fetchRequests = async () => {
      try {
        const response = await requestsApi.getAll()
        // Reverse array to show oldest to newest (CSS flex-direction handles scroll anchoring)
        requests.value = response.data.reverse()
      } catch (error) {
        console.error('Error fetching requests:', error)
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

    const checkNewImages = async () => {
      // Don't check for new images if we're filtering (only check on main library view)
      if (filters.value.requestId || filters.value.keywords) {
        return
      }

      try {
        // Fetch the latest images
        const response = await imagesApi.getAll(20, 0)
        const newImages = response.data

        if (newImages.length === 0) return

        // Find images we don't have yet
        const existingIds = new Set(images.value.map(img => img.uuid))
        const trulyNewImages = newImages.filter(img => !existingIds.has(img.uuid))

        if (trulyNewImages.length > 0) {
          // Prepend new images to the list
          images.value = [...trulyNewImages, ...images.value]
          console.log(`Added ${trulyNewImages.length} new image(s) to library`)
        }
      } catch (error) {
        console.error('Error checking for new images:', error)
      }
    }

    const startImagePolling = () => {
      if (imagesPollInterval) return // Already polling

      console.log('Starting image polling (active requests detected)')
      imagesPollInterval = setInterval(checkNewImages, 3000)
    }

    const stopImagePolling = () => {
      if (imagesPollInterval) {
        console.log('Stopping image polling (no active requests)')
        clearInterval(imagesPollInterval)
        imagesPollInterval = null
      }
    }

    const viewRequestImages = (requestId) => {
      // Set the request filter in localStorage
      const newFilters = {
        requestId: requestId,
        keywords: null
      }
      localStorage.setItem('libraryFilters', JSON.stringify(newFilters))
      filters.value = newFilters

      // Don't close the panel - keep it open for user convenience

      // Refresh images
      offset.value = 0
      hasMore.value = true
      fetchImages()
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

        // Refresh the image library to reflect deleted images
        offset.value = 0
        hasMore.value = true
        await fetchImages()
      } catch (error) {
        console.error('Error deleting request:', error)
        alert('Failed to delete request. Please try again.')
      }
    }

    // Listen for filter changes from localStorage (e.g., from other tabs or RequestCard)
    const handleStorageChange = (e) => {
      if (e.key === 'libraryFilters') {
        loadFilters()
        offset.value = 0
        hasMore.value = true
        fetchImages()
      }
    }

    // Watch for signal to open requests panel
    if (shouldOpenRequestsPanel) {
      watch(shouldOpenRequestsPanel, (shouldOpen) => {
        if (shouldOpen) {
          isPanelOpen.value = true
          // Reset the signal
          shouldOpenRequestsPanel.value = false
        }
      })
    }

    // Computed property for request status dot color
    const requestStatusClass = computed(() => {
      // Check if any request has failed status
      const hasFailed = requests.value.some(r => r.status === 'failed')
      if (hasFailed) return 'error'

      // Check if any request is in progress
      const hasActive = requests.value.some(r =>
        ['pending', 'submitting', 'processing', 'downloading'].includes(r.status)
      )
      if (hasActive) return 'active'

      // All requests are complete (or no requests)
      return 'complete'
    })

    // Watch queue status to start/stop image polling
    watch(queueStatus, (newStatus) => {
      if (!newStatus) return

      const hasActivity = newStatus.active > 0 || newStatus.pendingRequests > 0

      if (hasActivity) {
        // Clear any pending final check if we become active again
        if (finalImageCheckTimeout) {
          clearTimeout(finalImageCheckTimeout)
          finalImageCheckTimeout = null
        }
        startImagePolling()
        wasActive.value = true
      } else {
        stopImagePolling()

        // If we were active and now we're idle, schedule a final check
        // to catch any images that were still being saved
        if (wasActive.value) {
          console.log('Queue became idle, scheduling final image check in 3 seconds...')
          finalImageCheckTimeout = setTimeout(() => {
            console.log('Running final image check')
            checkNewImages()
            wasActive.value = false
            finalImageCheckTimeout = null
          }, 3000)
        }
      }
    })

    onMounted(async () => {
      loadFilters()
      await fetchImages()
      loadImageFromUrl()

      // Fetch requests and queue status
      fetchRequests()
      fetchQueueStatus()

      // Poll for updates every 2 seconds
      pollInterval = setInterval(() => {
        fetchRequests()
        fetchQueueStatus()
      }, 2000)

      window.addEventListener('scroll', handleScroll)
      window.addEventListener('storage', handleStorageChange)
    })

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      if (imagesPollInterval) {
        clearInterval(imagesPollInterval)
      }
      if (finalImageCheckTimeout) {
        clearTimeout(finalImageCheckTimeout)
      }
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('storage', handleStorageChange)
    })

    // Expose setFilter so it can be called from router navigation
    window.setLibraryFilter = setFilter

    return {
      images,
      loading,
      selectedImage,
      currentImageIndex,
      gridContainer,
      filters,
      searchQuery,
      getThumbnailUrl,
      formatDate,
      viewImage,
      closeImage,
      navigateImage,
      deleteImage,
      handleLoadSettings,
      handleImageUpdate,
      applySearch,
      clearFilter,
      clearAllFilters,
      toggleFavoritesFilter,
      toggleHiddenFilter,
      openSettings,
      openNewRequest,
      // Requests panel
      isPanelOpen,
      togglePanel,
      requests,
      queueStatus,
      requestStatusClass,
      viewRequestImages,
      showDeleteModal,
      confirmDelete,
      deleteModalVisible
    }
  }
}
</script>

<style scoped>
.library-view {
  padding: 0;
}

.header {
  position: sticky;
  top: 0;
  background: #000;
  z-index: 50;
  transition: top 0.3s ease-out;
}

.library-view.panel-open .header {
  top: 25vh;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  gap: 2rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header h2 {
  font-size: 2rem;
  font-weight: 600;
  white-space: nowrap;
  margin: 0;
}


.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.filter-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 16px;
  font-size: 0.875rem;
  color: #fff;
}

.chip-remove {
  background: transparent;
  border: none;
  color: #999;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin-left: 0.25rem;
  transition: color 0.2s;
}

.chip-remove:hover {
  color: #ff4a4a;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-filter {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #333;
  border-radius: 6px;
  color: #999;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-filter:hover {
  background: #1a1a1a;
  border-color: #666;
  color: #fff;
}

.btn-filter.active {
  background: #007AFF;
  border-color: #007AFF;
  color: #fff;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  width: 250px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #007AFF;
}

.search-input::placeholder {
  color: #666;
}

.btn-search {
  padding: 0.5rem 1rem;
  background: #007AFF;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.btn-search:hover {
  background: #0051D5;
}

.loading,
.loading-more {
  text-align: center;
  padding: 3rem 2rem;
  color: #999;
}

.loading-more {
  padding: 2rem;
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

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px;
  background: #000;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  background: #1a1a1a;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.image-item:hover img {
  transform: scale(1.05);
}

.favorite-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  color: #FFD60A;
  font-size: 1.5rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 2;
  pointer-events: none;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-overlay {
  opacity: 1;
}

.image-info {
  color: #fff;
  font-size: 0.85rem;
}

.date {
  font-weight: 500;
}

/* Floating Action Buttons */
.fab {
  position: fixed;
  bottom: 2rem;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #007AFF;
  color: white;
  border: none;
  font-size: 2.5rem;
  font-weight: 300;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-new {
  right: 2rem;
}

.fab-settings {
  left: 2rem;
  background: #555;
}

.fab:hover {
  background: #0051D5;
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
}

.fab-settings:hover {
  background: #777;
}

.fab:active {
  transform: scale(0.95);
}

/* Requests Panel Tab */
.panel-tab {
  position: absolute;
  top: 0;
  left: 50vw;
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 49;
}

.panel-tab .tab-content {
  background: #171717;
  border-radius: 0 0 12px 12px;
  border-top: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
}

.panel-tab:hover .tab-content {
  animation: bounce 0.4s ease-in-out;
}

@keyframes bounce {
  0% { padding-top: 0.75rem; padding-bottom: 0.75rem; }
  50% { padding-top: 1rem; padding-bottom: 0.75rem; }
  100% { padding-top: 0.75rem; padding-bottom: 0.75rem; }
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.complete {
  background: #00ff00;
}

.status-dot.active {
  background: #ffcc00;
  animation: pulse 2s infinite;
}

.status-dot.error {
  background: #ff3b30;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tab-text {
  font-size: 0.95rem;
  color: #fff;
  font-weight: 500;
}

/* Requests Panel */
.requests-panel {
  position: sticky;
  top: 0;
  background: #171717;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out, box-shadow 0.3s ease-out;
  box-shadow: none;
  z-index: 51;
  display: flex;
  flex-direction: column-reverse;
}

.requests-panel.open {
  max-height: 25vh;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.panel-content {
  padding: 1.5rem 2rem;
  background: #171717;
}

.panel-empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #666;
}

.panel-empty-state p {
  margin-bottom: 0.5rem;
}

.panel-empty-state .hint {
  font-size: 0.9rem;
  color: #555;
}

.requests-grid {
  display: grid;
  gap: 1rem;
}
</style>
