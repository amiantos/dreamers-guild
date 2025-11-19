<template>
  <div class="library-view" :class="{ 'panel-open': isPanelOpen }">
    <!-- Keywords Panel -->
    <KeywordsPanel
      :keywords="keywords"
      :isOpen="isKeywordsPanelOpen"
      @close="isKeywordsPanelOpen = false"
      @select="selectKeyword"
    />

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
            class="request-card-item"
            @view-images="viewRequestImages"
            @delete="showDeleteModal"
          />

          <button
            @click="showDeleteAllModal"
            class="btn-clear-history"
          >
            <i class="fa-solid fa-trash"></i>
            Clear Request History
          </button>
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

            <!-- Favorites Toggle Button -->
            <button
              @click="toggleFavorites"
              class="btn-favorites-toggle"
              :class="{ active: filters.showFavoritesOnly }"
              title="Show Favorites"
            >
              <i class="fa-solid fa-star"></i>
            </button>

            <!-- Keywords Panel Toggle Button -->
            <button @click="toggleKeywordsPanel" class="btn-keywords-toggle" title="Keywords">
              <i class="fa-solid fa-filter"></i>
            </button>

            <!-- Overflow Menu -->
            <div class="menu-container" ref="menuContainer">
              <button @click="toggleMenu" class="btn-menu" title="More options">
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </button>
              <div v-if="showMenu" class="menu-dropdown">
                <div class="menu-item" @click="toggleHiddenImages">
                  <span>{{ filters.showHidden ? 'Hide Hidden Images' : 'Show Hidden Images' }}</span>
                </div>
              </div>
            </div>
          </div>
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
    <router-link to="/settings" class="fab fab-settings" title="Settings">
      <i class="fa-solid fa-gear"></i>
    </router-link>

    <!-- Floating Action Button (New Request) -->
    <button @click="openNewRequest" class="fab fab-new" title="New Request">
      <i class="fa-solid fa-plus"></i>
    </button>

    <!-- Requests Panel Toggle Tab (moved to bottom) -->
    <div class="panel-tab" @click="togglePanel" :class="{ open: isPanelOpen }">
      <div class="tab-content">
        <span class="status-dot" :class="requestStatusClass"></span>
        <span class="tab-text">Requests</span>
      </div>
    </div>
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
import KeywordsPanel from '../components/KeywordsPanel.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal,
    RequestCard,
    DeleteRequestModal,
    DeleteAllRequestsModal,
    KeywordsPanel
  },
  props: {
    imageId: String // selected image ID from URL
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    const images = ref([])
    const totalCount = ref(0)
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

    // Keywords panel state
    const isKeywordsPanelOpen = ref(false)
    const keywords = ref([])

    // Menu state
    const showMenu = ref(false)
    const menuContainer = ref(null)

    // Initialize image polling composable
    const imagePolling = useImagePolling({
      filters,
      images,
      onNewImages: () => {
        // Refresh keywords when new images are added
        fetchKeywords()
      }
    })

    // Inject functions from App.vue
    const loadSettingsFromImage = inject('loadSettingsFromImage')
    const openRequestModal = inject('openRequestModal')
    const shouldOpenRequestsPanel = inject('shouldOpenRequestsPanel')
    const checkHiddenAuth = inject('checkHiddenAuth')
    const requestHiddenAccess = inject('requestHiddenAccess')

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
      const count = totalCount.value
      return `${count} Image${count !== 1 ? 's' : ''}`
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
          // Join keywords with comma for search (supports AND filtering)
          const searchTerms = filters.value.keywords.join(',')
          response = await imagesApi.search(searchTerms, limit, filters.value)
          hasMore.value = false // Search doesn't paginate yet
        } else {
          response = await imagesApi.getAll(limit, offset.value, filters.value)
        }

        const newImages = response.data.data || []
        totalCount.value = response.data.total || 0

        if (append) {
          images.value = [...images.value, ...newImages]
        } else {
          images.value = newImages
          offset.value = 0
        }

        if (newImages.length < limit) {
          hasMore.value = false
        } else {
          offset.value += limit
        }
      } catch (error) {
        console.error('Error fetching images:', error)
        totalCount.value = 0
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

    const toggleFavorites = () => {
      filters.value.showFavoritesOnly = !filters.value.showFavoritesOnly
      offset.value = 0
      hasMore.value = true
      fetchImages()
      updateFilterUrl()
    }

    const toggleMenu = () => {
      showMenu.value = !showMenu.value
    }

    const toggleHiddenImages = () => {
      // Close the menu
      showMenu.value = false

      // If turning on, check authentication first
      if (!filters.value.showHidden) {
        // Check if user has access
        if (checkHiddenAuth && !checkHiddenAuth()) {
          // Request PIN access
          if (requestHiddenAccess) {
            requestHiddenAccess(() => {
              // After successful auth, toggle on
              filters.value.showHidden = true
              sessionStorage.setItem('showHidden', 'true')
              offset.value = 0
              hasMore.value = true
              fetchImages()
              fetchKeywords()
            })
          }
          return
        }
      }

      // Toggle the hidden images filter
      filters.value.showHidden = !filters.value.showHidden

      // Save to sessionStorage
      if (filters.value.showHidden) {
        sessionStorage.setItem('showHidden', 'true')
      } else {
        sessionStorage.removeItem('showHidden')
      }

      offset.value = 0
      hasMore.value = true
      fetchImages()
      fetchKeywords()
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
        // Refresh keywords since counts and keywords may have changed
        fetchKeywords()
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

          // Refresh keywords if favorite or hidden status changed
          fetchKeywords()
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

          // Refresh keywords for favorite changes
          fetchKeywords()
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
        // Show newest to oldest
        requests.value = response.data
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

    // Keywords panel functions
    const toggleKeywordsPanel = () => {
      isKeywordsPanelOpen.value = !isKeywordsPanelOpen.value
    }

    const fetchKeywords = async () => {
      try {
        const response = await albumsApi.getAll(filters.value)
        keywords.value = response.data
      } catch (error) {
        console.error('Error fetching keywords:', error)
      }
    }

    const updateFilterUrl = () => {
      // Build query params
      const query = {}

      // Add favorites as special keyword if enabled
      const queryKeywords = [...filters.value.keywords]
      if (filters.value.showFavoritesOnly) {
        queryKeywords.unshift('favorites')
      }

      if (queryKeywords.length > 0) {
        query.q = queryKeywords.join(',')
      }

      // Update URL without triggering navigation
      router.replace({ path: '/', query })
    }

    const loadFiltersFromUrl = () => {
      // Reset filters
      filters.value.showFavoritesOnly = false
      filters.value.keywords = []

      // Load keywords from query params
      if (route.query.q) {
        const queryKeywords = route.query.q.split(',').filter(k => k.trim().length > 0)

        // Check for special 'favorites' keyword
        const favoritesIndex = queryKeywords.indexOf('favorites')
        if (favoritesIndex !== -1) {
          filters.value.showFavoritesOnly = true
          // Remove 'favorites' from keywords array (it's not a real search term)
          queryKeywords.splice(favoritesIndex, 1)
        }

        // Set remaining keywords
        filters.value.keywords = queryKeywords
      }

      // Load showHidden from sessionStorage (persists across navigation)
      const savedShowHidden = sessionStorage.getItem('showHidden')
      if (savedShowHidden === 'true') {
        filters.value.showHidden = true
      }
    }

    const selectKeyword = (keyword) => {
      // Update filters based on keyword selection
      filters.value.requestId = null

      if (keyword.id.startsWith('keyword:')) {
        // Extract keyword from ID and toggle it
        const keywordText = keyword.id.replace('keyword:', '')
        const index = filters.value.keywords.indexOf(keywordText)
        if (index !== -1) {
          // Remove keyword if already present
          filters.value.keywords.splice(index, 1)
        } else {
          // Add keyword if not present
          filters.value.keywords.push(keywordText)
        }
        // Keep current favorite/hidden filters intact for keyword searches
      }

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

    // Watch for filter changes to refresh keywords
    watch(
      () => ({ showFavoritesOnly: filters.value.showFavoritesOnly, showHidden: filters.value.showHidden }),
      () => {
        fetchKeywords()
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
      fetchKeywords()
    })

    const handleClickOutside = (event) => {
      if (menuContainer.value && !menuContainer.value.contains(event.target)) {
        showMenu.value = false
      }
    }

    onMounted(async () => {
      loadFiltersFromUrl()
      await fetchImages()
      loadImageFromUrl()

      // Fetch requests and queue status
      fetchRequests()
      fetchQueueStatus()

      // Fetch keywords
      fetchKeywords()

      // Poll for updates every 2 seconds
      pollInterval = setInterval(() => {
        fetchRequests()
        fetchQueueStatus()
      }, 2000)

      window.addEventListener('scroll', handleScroll)
      window.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      imagePolling.cleanup()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('click', handleClickOutside)
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
      // Keywords panel
      isKeywordsPanelOpen,
      toggleKeywordsPanel,
      keywords,
      selectKeyword,
      // Menu and filters
      showMenu,
      menuContainer,
      toggleFavorites,
      toggleMenu,
      toggleHiddenImages,
      checkHiddenAuth
    }
  }
}
</script>

<style scoped>
.library-view {
  padding: 0;
  --panel-height: 30vh;
  transition: padding-bottom 0.3s ease-out;
}

.library-view.panel-open {
  padding-bottom: var(--panel-height);
}

.header {
  position: sticky;
  top: 0;
  background: #000;
  z-index: 50;
  transition: top 0.3s ease-out;
}

.library-view.panel-open .header {
  /* No longer pushing header down */
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

.btn-keywords-toggle {
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

.btn-keywords-toggle:hover {
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

.btn-favorites-toggle {
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

.btn-favorites-toggle:hover {
  background: #1a1a1a;
  border-color: #666;
  color: #FFD60A;
}

.btn-favorites-toggle.active {
  background: #1a1a1a;
  border-color: #FFD60A;
  color: #FFD60A;
}

.menu-container {
  position: relative;
}

.btn-menu {
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

.btn-menu:hover {
  background: #1a1a1a;
  border-color: #666;
  color: #fff;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  min-width: 183px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 100;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #2a2a2a;
}

.menu-item i {
  width: 20px;
  color: #999;
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
  font-size: 1rem;
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
  font-size: 1rem;
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
  transition: all 0.2s, transform 0.3s ease-out;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
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

.library-view.panel-open .fab {
  transform: translateY(calc(-1 * var(--panel-height)));
}

.library-view.panel-open .fab:hover {
  transform: translateY(calc(-1 * var(--panel-height))) scale(1.05);
}

.library-view.panel-open .fab:active {
  transform: translateY(calc(-1 * var(--panel-height))) scale(0.95);
}

/* Requests Panel Tab */
.panel-tab {
  position: fixed;
  bottom: 0;
  top: auto;
  left: 50%;
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 60; /* Higher than FABs (40) and Header (50) */
  transition: transform 0.3s ease-out;
}

.library-view.panel-open .panel-tab {
  transform: translate(-50%, calc(-1 * var(--panel-height) + 1px));
}

.panel-tab .tab-content {
  background: #171717;
  border-radius: 12px 12px 0 0;
  border-bottom: none;
  box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.3);
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
  50% { padding-top: 0.75rem; padding-bottom: 1rem; }
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
  position: fixed;
  bottom: 0;
  top: auto;
  left: 0;
  right: 0;
  background: #171717;
  max-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  transition: transform 0.3s ease-out, box-shadow 0.3s ease-out;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  z-index: 55; /* Above header but below tab */
  display: flex;
  flex-direction: column; /* Normal direction now */
  height: var(--panel-height);
  max-height: var(--panel-height);
  transform: translateY(100%);
}

.requests-panel.open {
  transform: translateY(0);
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

.request-card-item:not(:last-child) {
  border-bottom: 1px solid #333;
  padding-bottom: 1rem;
}
</style>
