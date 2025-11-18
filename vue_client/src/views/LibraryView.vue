<template>
  <div class="library-view" :class="{ 'panel-open': isPanelOpen }">
    <!-- Albums Panel -->
    <AlbumsPanel
      :albums="albums"
      :isOpen="isAlbumsPanelOpen"
      @close="isAlbumsPanelOpen = false"
      @select="selectAlbum"
    />

    <!-- Requests Panel -->
    <div class="requests-panel" :class="{ open: isPanelOpen }">
      <div class="panel-content">
        <div v-if="requests.length === 0" class="panel-empty-state">
          <p>No requests yet</p>
          <p class="hint">Click the + button to generate your first AI image</p>
        </div>

        <div v-else class="requests-grid">
          <button
            @click="showDeleteAllModal"
            class="btn-clear-history"
          >
            <i class="fa-solid fa-trash"></i>
            Clear Request History
          </button>

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
      :request="requestToDelete"
      @close="deleteModalVisible = false"
      @delete="confirmDelete"
    />

    <DeleteAllRequestsModal
      v-if="deleteAllModalVisible"
      :requests="requests"
      @close="deleteAllModalVisible = false"
      @delete="confirmDeleteAll"
    />

    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <button @click="toggleAlbumsPanel" class="btn-albums-toggle" title="Albums">
            <i class="fa-solid fa-folder"></i>
          </button>
          <h2>{{ galleryTitle }}</h2>
        </div>

        <div class="header-controls">
          <div class="right-controls">
            <!-- Active Filters -->
            <div v-if="filters.requestId || filters.keywords.length > 0" class="filter-chips">
              <div v-if="filters.requestId" class="filter-chip">
                <span>Request: {{ filters.requestId.substring(0, 8) }}</span>
                <button @click="clearFilter('requestId')" class="chip-remove">×</button>
              </div>
              <div v-for="keyword in filters.keywords" :key="keyword" class="filter-chip">
                <span>{{ keyword }}</span>
                <button @click="clearFilter('keywords', keyword)" class="chip-remove">×</button>
              </div>
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
        :class="{ 'hidden-locked': image.is_hidden && checkHiddenAuth && !checkHiddenAuth() }"
      >
        <div v-if="image.is_hidden && checkHiddenAuth && !checkHiddenAuth()" class="locked-placeholder">
          <i class="fa-solid fa-lock"></i>
          <span>Hidden</span>
        </div>
        <img
          v-else
          :src="getThumbnailUrl(image.uuid)"
          :alt="image.prompt_simple"
          loading="lazy"
        />
        <div v-if="image.is_favorite" class="favorite-badge" title="Favorited">
          <i class="fa-solid fa-star"></i>
        </div>
        <div v-if="image.is_hidden && (!checkHiddenAuth || checkHiddenAuth())" class="hidden-badge" title="Hidden">
          <i class="fa-solid fa-eye-slash"></i>
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
      <i class="fa-solid fa-gear"></i>
    </button>

    <!-- Floating Action Button (New Request) -->
    <button @click="openNewRequest" class="fab fab-new" title="New Request">
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { imagesApi, requestsApi, albumsApi } from '../api/client.js'
import { useImagePolling } from '../composables/useImagePolling.js'
import ImageModal from '../components/ImageModal.vue'
import RequestCard from '../components/RequestCard.vue'
import DeleteRequestModal from '../components/DeleteRequestModal.vue'
import DeleteAllRequestsModal from '../components/DeleteAllRequestsModal.vue'
import AlbumsPanel from '../components/AlbumsPanel.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal,
    RequestCard,
    DeleteRequestModal,
    DeleteAllRequestsModal,
    AlbumsPanel
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
    const limit = 100
    const searchQuery = ref('')
    const filters = ref({
      requestId: null,
      keywords: [], // Changed to array for multiple keywords
      showFavoritesOnly: false,
      showHidden: false
    })
    const routeBeforeModal = ref(null) // Store route before opening modal

    // Requests panel state
    const isPanelOpen = ref(false)
    const requests = ref([])
    const queueStatus = ref(null)
    const deleteModalVisible = ref(false)
    const deleteAllModalVisible = ref(false)
    const requestToDelete = ref(null)
    let pollInterval = null

    // Albums panel state
    const isAlbumsPanelOpen = ref(false)
    const albums = ref([])

    // Initialize image polling composable
    const imagePolling = useImagePolling({
      filters,
      images,
      onNewImages: () => {
        // Refresh albums when new images are added
        fetchAlbums()
      }
    })

    // Inject functions from App.vue
    const loadSettingsFromImage = inject('loadSettingsFromImage')
    const openSettingsModal = inject('openSettingsModal')
    const openRequestModal = inject('openRequestModal')
    const shouldOpenRequestsPanel = inject('shouldOpenRequestsPanel')
    const checkHiddenAuth = inject('checkHiddenAuth')
    const requestHiddenAccess = inject('requestHiddenAccess')

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

    const currentImageIndex = computed(() => {
      if (!selectedImage.value) return -1
      return images.value.findIndex(img => img.uuid === selectedImage.value.uuid)
    })

    const galleryTitle = computed(() => {
      if (filters.value.showFavoritesOnly) {
        return 'Favorite Images'
      } else if (filters.value.showHidden) {
        return 'Hidden Images'
      }
      return 'All Images'
    })

    const fetchImages = async (append = false) => {
      if (!hasMore.value && append) return

      try {
        loading.value = true
        let response

        if (filters.value.requestId) {
          response = await imagesApi.getByRequestId(filters.value.requestId, limit)
          hasMore.value = false // Request images don't paginate
        } else if (filters.value.keywords.length > 0) {
          // Join keywords with space for search
          const searchTerms = filters.value.keywords.join(' ')
          response = await imagesApi.search(searchTerms, limit, filters.value)
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
      // Check if image is hidden and user is not authenticated
      if (image.is_hidden && checkHiddenAuth && !checkHiddenAuth()) {
        if (requestHiddenAccess) {
          requestHiddenAccess(() => {
            // After successful auth, view the image
            viewImage(image)
          })
        }
        return
      }

      // Store the current route before opening the modal
      if (!selectedImage.value) {
        routeBeforeModal.value = {
          path: route.path,
          query: { ...route.query }
        }
      }

      selectedImage.value = image
      // Update URL for bookmarking, but don't trigger route watcher
      router.replace(`/image/${image.uuid}`)
    }

    const closeImage = () => {
      selectedImage.value = null
      // Restore the route to what it was before opening the modal
      if (routeBeforeModal.value) {
        router.replace({
          path: routeBeforeModal.value.path,
          query: routeBeforeModal.value.query
        })
        routeBeforeModal.value = null
      } else {
        // Fallback to root if no stored route
        router.replace('/')
      }
    }

    const setFilter = (filterType, value) => {
      filters.value[filterType] = value
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const clearFilter = (filterType, value = null) => {
      if (filterType === 'keywords' && value) {
        // Remove specific keyword from array
        filters.value.keywords = filters.value.keywords.filter(k => k !== value)
      } else if (filterType === 'keywords') {
        // Clear all keywords
        filters.value.keywords = []
      } else {
        filters.value[filterType] = null
      }
      offset.value = 0
      hasMore.value = true
      fetchImages()
      updateFilterUrl()
    }

    const applySearch = () => {
      const term = searchQuery.value.trim()
      if (term && !filters.value.keywords.includes(term)) {
        // Add to keywords array if not already present
        filters.value.keywords.push(term)
        searchQuery.value = '' // Clear search box
        offset.value = 0
        hasMore.value = true
        fetchImages()
        updateFilterUrl()
      }
    }

    const clearAllFilters = () => {
      filters.value.requestId = null
      filters.value.keywords = []
      filters.value.showFavoritesOnly = false
      filters.value.showHidden = false
      searchQuery.value = ''
      offset.value = 0
      hasMore.value = true
      fetchImages()
      updateFilterUrl()
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
        // Update URL for bookmarking, but don't trigger route watcher
        router.replace(`/image/${newImage.uuid}`)
      }
    }

    const updateImageUrl = (imageId) => {
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
        // Refresh albums since counts and keywords may have changed
        fetchAlbums()
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

        // Check if hidden status changed and image should be removed from current view
        if ('is_hidden' in updates) {
          const shouldRemove = (
            // Image was hidden and we're NOT in hidden gallery
            (updates.is_hidden === 1 && !filters.value.showHidden) ||
            // Image was unhidden and we ARE in hidden gallery
            (updates.is_hidden === 0 && filters.value.showHidden)
          )

          if (shouldRemove) {
            // Remove the image from the array
            images.value.splice(imageIndex, 1)

            // If this is the currently selected image, navigate or close
            if (selectedImage.value && selectedImage.value.uuid === updates.uuid) {
              if (images.value.length === 0) {
                // No more images, close the modal
                closeImage()
              } else {
                // Navigate to the next image (or previous if we were at the end)
                let newIndex = imageIndex
                if (newIndex >= images.value.length) {
                  newIndex = images.value.length - 1
                }
                const newImage = images.value[newIndex]
                if (newImage) {
                  selectedImage.value = newImage
                  router.replace(`/image/${newImage.uuid}`)
                } else {
                  closeImage()
                }
              }
            }
          }

          // Refresh albums if favorite or hidden status changed
          fetchAlbums()
        } else if ('is_favorite' in updates) {
          // Check if favorite status changed and image should be removed from current view
          const shouldRemove = (
            // Image was unfavorited and we're in favorites gallery
            (updates.is_favorite === 0 && filters.value.showFavoritesOnly)
          )

          if (shouldRemove) {
            // Remove the image from the array
            images.value.splice(imageIndex, 1)

            // If this is the currently selected image, navigate or close
            if (selectedImage.value && selectedImage.value.uuid === updates.uuid) {
              if (images.value.length === 0) {
                // No more images, close the modal
                closeImage()
              } else {
                // Navigate to the next image (or previous if we were at the end)
                let newIndex = imageIndex
                if (newIndex >= images.value.length) {
                  newIndex = images.value.length - 1
                }
                const newImage = images.value[newIndex]
                if (newImage) {
                  selectedImage.value = newImage
                  router.replace(`/image/${newImage.uuid}`)
                } else {
                  closeImage()
                }
              }
            }
          }

          // Refresh albums for favorite changes
          fetchAlbums()
        }
      }
    }

    // Load image from URL if imageId prop is present
    const loadImageFromUrl = async () => {
      if (props.imageId && images.value.length > 0) {
        const image = images.value.find(img => img.uuid === props.imageId)
        if (image) {
          // Always show the image, ImageModal will handle blur protection for hidden images
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


    const viewRequestImages = (requestId) => {
      filters.value.requestId = requestId
      filters.value.keywords = []

      // Don't close the panel - keep it open for user convenience

      // Refresh images
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const showDeleteModal = (requestId) => {
      const request = requests.value.find(r => r.uuid === requestId)

      // For failed requests, delete immediately without confirmation
      if (request.status === 'failed') {
        requestToDelete.value = request
        confirmDelete('prune')
        return
      }

      requestToDelete.value = request
      deleteModalVisible.value = true
    }

    const confirmDelete = async (imageAction) => {
      if (!requestToDelete.value) return

      try {
        await requestsApi.delete(requestToDelete.value.uuid, imageAction)
        requests.value = requests.value.filter(r => r.uuid !== requestToDelete.value.uuid)
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

    const showDeleteAllModal = () => {
      deleteAllModalVisible.value = true
    }

    const confirmDeleteAll = async (imageAction) => {
      try {
        await requestsApi.deleteAll(imageAction)
        requests.value = []
        deleteAllModalVisible.value = false

        // Refresh the image library to reflect deleted images
        offset.value = 0
        hasMore.value = true
        await fetchImages()
      } catch (error) {
        console.error('Error deleting all requests:', error)
        alert('Failed to delete all requests. Please try again.')
      }
    }

    // Albums panel functions
    const toggleAlbumsPanel = () => {
      isAlbumsPanelOpen.value = !isAlbumsPanelOpen.value
    }

    const fetchAlbums = async () => {
      try {
        const response = await albumsApi.getAll(filters.value)
        albums.value = response.data
      } catch (error) {
        console.error('Error fetching albums:', error)
      }
    }

    const updateFilterUrl = () => {
      // Build the path based on current filters
      let path = '/'
      if (filters.value.showFavoritesOnly) {
        path = '/favorites'
      } else if (filters.value.showHidden) {
        path = '/hidden'
      }

      // Build query params
      const query = {}
      if (filters.value.keywords.length > 0) {
        query.q = filters.value.keywords.join(',')
      }

      // Update URL without triggering navigation
      router.replace({ path, query })
    }

    const loadFiltersFromUrl = () => {
      // Load filters from route
      if (route.path === '/favorites') {
        filters.value.showFavoritesOnly = true
        filters.value.showHidden = false
      } else if (route.path === '/hidden') {
        // Check if user has access to hidden gallery
        if (checkHiddenAuth && !checkHiddenAuth()) {
          // Request PIN access
          if (requestHiddenAccess) {
            requestHiddenAccess(() => {
              // After successful auth, set the filter and load images
              filters.value.showFavoritesOnly = false
              filters.value.showHidden = true
              offset.value = 0
              hasMore.value = true
              fetchImages()
              fetchAlbums()
            })
          }
          // Navigate back to home while waiting for auth
          router.replace('/')
          return
        } else {
          filters.value.showFavoritesOnly = false
          filters.value.showHidden = true
        }
      } else {
        filters.value.showFavoritesOnly = false
        filters.value.showHidden = false
      }

      // Load keywords from query params
      if (route.query.q) {
        filters.value.keywords = route.query.q.split(',').filter(k => k.trim().length > 0)
      } else {
        filters.value.keywords = []
      }
    }

    const selectAlbum = (album) => {
      // Update filters based on album selection
      filters.value.requestId = null

      if (album.id === 'all') {
        filters.value.showFavoritesOnly = false
        filters.value.showHidden = false
        filters.value.keywords = []
      } else if (album.id === 'favorites') {
        filters.value.showFavoritesOnly = true
        filters.value.showHidden = false
        filters.value.keywords = []
      } else if (album.id === 'hidden') {
        // Check if user has access to hidden gallery
        if (checkHiddenAuth && !checkHiddenAuth()) {
          // Close the albums panel first
          isAlbumsPanelOpen.value = false

          // Request PIN access
          if (requestHiddenAccess) {
            requestHiddenAccess(() => {
              // After successful auth, navigate to hidden gallery
              router.push('/hidden')
            })
          }
          return
        } else {
          filters.value.showFavoritesOnly = false
          filters.value.showHidden = true
          filters.value.keywords = []
        }
      } else if (album.id.startsWith('keyword:')) {
        // Extract keyword from ID and add to array if not present
        const keyword = album.id.replace('keyword:', '')
        if (!filters.value.keywords.includes(keyword)) {
          filters.value.keywords.push(keyword)
        }
        // Keep current favorite/hidden filters intact for keyword searches
      }

      // Close the albums panel
      isAlbumsPanelOpen.value = false

      // Refresh images with new filters
      offset.value = 0
      hasMore.value = true
      fetchImages()
      updateFilterUrl()
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

    // Watch for filter changes to refresh keyword albums
    watch(
      () => ({ showFavoritesOnly: filters.value.showFavoritesOnly, showHidden: filters.value.showHidden }),
      () => {
        fetchAlbums()
      }
    )

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
    imagePolling.watchQueueStatus(queueStatus)

    // Watch for route changes to update filters
    watch(() => route.path + route.query.q, (newVal, oldVal) => {
      // Ignore route changes when opening/closing/navigating the modal
      // This allows URL updates for bookmarking without triggering data reloads
      const newPath = route.path
      const oldPath = oldVal ? oldVal.split('?')[0] : ''

      if (newPath.startsWith('/image/') || oldPath.startsWith('/image/')) {
        // Modal-related route change - don't reload data
        return
      }

      loadFiltersFromUrl()
      offset.value = 0
      hasMore.value = true
      fetchImages()
      fetchAlbums()
    })

    onMounted(async () => {
      loadFiltersFromUrl()
      await fetchImages()
      loadImageFromUrl()

      // Fetch requests and queue status
      fetchRequests()
      fetchQueueStatus()

      // Fetch albums
      fetchAlbums()

      // Poll for updates every 2 seconds
      pollInterval = setInterval(() => {
        fetchRequests()
        fetchQueueStatus()
      }, 2000)

      window.addEventListener('scroll', handleScroll)
    })

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      imagePolling.cleanup()
      window.removeEventListener('scroll', handleScroll)
    })

    return {
      images,
      loading,
      selectedImage,
      currentImageIndex,
      galleryTitle,
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
      deleteModalVisible,
      deleteAllModalVisible,
      showDeleteAllModal,
      confirmDeleteAll,
      requestToDelete,
      // Albums panel
      isAlbumsPanelOpen,
      toggleAlbumsPanel,
      albums,
      selectAlbum
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

.btn-albums-toggle {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid #333;
  color: #999;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-albums-toggle:hover {
  background: #1a1a1a;
  border-color: #666;
  color: #fff;
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

.hidden-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  color: #999;
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

.locked-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  color: #999;
  gap: 0.5rem;
}

.locked-placeholder i {
  font-size: 2rem;
}

.locked-placeholder span {
  font-size: 0.875rem;
  font-weight: 500;
}

.hidden-locked {
  cursor: pointer;
}

.hidden-locked:hover .locked-placeholder {
  background: rgba(0, 0, 0, 0.95);
  color: #bbb;
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
  position: relative;
}

.btn-clear-history {
  width: 100%;
  padding: 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #999;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-clear-history:hover {
  background: #3a3a3a;
  border-color: #ff6b6b;
  color: #ff6b6b;
}

.btn-clear-history:active {
  transform: scale(0.98);
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
