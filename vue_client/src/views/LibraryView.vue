<template>
  <div class="library-view" :class="{ 'panel-open': isPanelOpen }">
    <!-- Albums Modal -->
    <AlbumsModal
      :keywords="keywords"
      :isOpen="isAlbumsModalOpen"
      @close="isAlbumsModalOpen = false"
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

    <BatchDeleteModal
      v-if="showBatchDeleteModal"
      :count="selectedCount"
      @close="showBatchDeleteModal = false"
      @delete="batchDelete"
    />

    <div class="header">
      <div class="header-content">
        <div class="header-row-1">
          <div class="header-left">
            <h2>{{ galleryTitle }}</h2>
          </div>

          <div class="header-controls">
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
              aria-label="Show Favorites"
            >
              <i class="fa-solid fa-star" aria-hidden="true"></i>
            </button>

            <!-- Albums Modal Toggle Button -->
            <button @click="toggleAlbumsModal" class="btn-albums-toggle" title="Albums" aria-label="Open Albums">
              <i class="fa-solid fa-images" aria-hidden="true"></i>
            </button>

            <!-- Overflow Menu -->
            <div class="menu-container" ref="menuContainer">
              <button @click="toggleMenu" class="btn-menu" title="More options" aria-label="More options">
                <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
              </button>
              <div v-if="showMenu" class="menu-dropdown">
                <div class="menu-item" @click="toggleMultiSelectMode">
                  <span>Multi-Select Mode</span>
                </div>
                <div class="menu-item" @click="toggleHiddenImages">
                  <span>{{ filters.showHidden ? 'Hide Hidden Images' : 'Show Hidden Images' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Filters Row -->
        <div v-if="filters.requestId || filters.keywords.length > 0" class="header-row-2">
          <div class="filter-chips-container">
            <div class="filter-chips">
              <div v-if="filters.requestId" class="filter-chip">
                <span>Request: {{ filters.requestId.substring(0, 8) }}</span>
                <button @click="clearFilter('requestId')" class="chip-remove" aria-label="Remove request filter">×</button>
              </div>
              <div v-for="keyword in filters.keywords" :key="keyword" class="filter-chip">
                <span>{{ keyword }}</span>
                <button @click="clearFilter('keywords', keyword)" class="chip-remove" :aria-label="'Remove ' + keyword + ' filter'">×</button>
              </div>
            </div>
          </div>
          <!-- Clear All Button -->
          <button v-if="filters.keywords.length > 1" @click="clearAllFilters" class="btn-clear-filters" title="Clear all filters">
            Clear All
          </button>
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
        @click="handleImageClick(image, $event)"
        :class="{
          'hidden-locked': image.is_hidden && checkHiddenAuth && !checkHiddenAuth(),
          'multi-select-mode': isMultiSelectMode || selectedCount > 0,
          'selected': selectedImages.has(image.uuid)
        }"
      >
        <div v-if="image.is_hidden && checkHiddenAuth && !checkHiddenAuth()" class="locked-placeholder">
          <i class="fa-solid fa-lock"></i>
          <span>Hidden</span>
        </div>
        <AsyncImage
          v-else
          :src="getThumbnailUrl(image.uuid)"
          :alt="image.prompt_simple"
          loading="lazy"
        />

        <!-- Selection checkbox (show when in multi-select mode OR when there are selections) -->
        <div v-if="isMultiSelectMode || selectedCount > 0" class="selection-checkbox">
          <div class="checkbox" :class="{ checked: selectedImages.has(image.uuid) }">
            <i v-if="selectedImages.has(image.uuid)" class="fa-solid fa-check"></i>
          </div>
        </div>

        <div v-if="image.is_favorite" class="favorite-badge" title="Favorited">
          <i class="fa-solid fa-star"></i>
        </div>
        <div v-if="image.is_hidden && (!checkHiddenAuth || checkHiddenAuth())" class="hidden-badge" title="Hidden">
          <i class="fa-solid fa-eye-slash"></i>
        </div>
        <div v-if="selectedCount === 0" class="image-overlay">
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
      :canNavigatePrev="canNavigatePrev"
      :canNavigateNext="canNavigateNext"
      @close="closeImage"
      @delete="deleteImage"
      @navigate="navigateImage"
      @load-settings="handleLoadSettings"
      @update="handleImageUpdate"
    />

    <!-- Floating Action Button (Settings) -->
    <router-link v-if="selectedCount === 0" to="/settings" class="fab fab-settings" title="Settings">
      <i class="fa-solid fa-gear"></i>
    </router-link>

    <!-- Floating Action Button (New Request) -->
    <button v-if="selectedCount === 0" @click="openNewRequest" class="fab fab-new" title="New Request">
      <i class="fa-solid fa-plus"></i>
    </button>

    <!-- Multi-Select Action Bar (show when images are selected OR in dedicated multi-select mode) -->
    <div v-if="selectedCount > 0 || isMultiSelectMode" class="multi-select-action-bar">
      <div class="action-bar-content">
        <div class="selection-info">
          <span class="count">{{ selectedCount }} selected</span>
        </div>
        <div class="action-buttons">
          <button @click="isMultiSelectMode ? toggleMultiSelectMode() : (selectedImages.clear(), lastSelectedIndex = -1)" class="btn-action btn-cancel" title="Cancel">
            <i class="fa-solid fa-times"></i>
            <span>Cancel</span>
          </button>
          <button @click="batchFavorite" :disabled="selectedCount === 0" class="btn-action btn-favorite" title="Favorite">
            <i class="fa-solid fa-star"></i>
            <span>Favorite</span>
          </button>
          <button @click="batchUnfavorite" :disabled="selectedCount === 0" class="btn-action btn-unfavorite" title="Unfavorite">
            <i class="fa-regular fa-star"></i>
            <span>Unfavorite</span>
          </button>
          <button @click="batchHide" :disabled="selectedCount === 0" class="btn-action btn-hide" title="Hide">
            <i class="fa-solid fa-eye-slash"></i>
            <span>Hide</span>
          </button>
          <button @click="batchUnhide" :disabled="selectedCount === 0" class="btn-action btn-unhide" title="Unhide">
            <i class="fa-solid fa-eye"></i>
            <span>Unhide</span>
          </button>
          <button @click="showBatchDeleteModal = true" :disabled="selectedCount === 0" class="btn-action btn-delete" title="Delete">
            <i class="fa-solid fa-trash"></i>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Requests Panel Toggle Tab (moved to bottom) -->
    <div v-if="selectedCount === 0" class="panel-tab" @click="togglePanel" :class="{ open: isPanelOpen }">
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
import { imagesApi, requestsApi, albumsApi } from '@api'
import { useImagePolling } from '../composables/useImagePolling.js'
import ImageModal from '../components/ImageModal.vue'
import RequestCard from '../components/RequestCard.vue'
import DeleteRequestModal from '../components/DeleteRequestModal.vue'
import DeleteAllRequestsModal from '../components/DeleteAllRequestsModal.vue'
import BatchDeleteModal from '../components/BatchDeleteModal.vue'
import AlbumsModal from '../components/AlbumsModal.vue'
import AsyncImage from '../components/AsyncImage.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal,
    RequestCard,
    DeleteRequestModal,
    DeleteAllRequestsModal,
    BatchDeleteModal,
    AlbumsModal,
    AsyncImage
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

    // Albums modal state
    const isAlbumsModalOpen = ref(false)
    const keywords = ref([])

    // Menu state
    const showMenu = ref(false)
    const menuContainer = ref(null)

    // Multi-select mode state
    const isMultiSelectMode = ref(false)
    const selectedImages = ref(new Set())
    const lastSelectedIndex = ref(-1)

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
    const clearHiddenAuth = inject('clearHiddenAuth')

    const openNewRequest = () => {
      if (openRequestModal) {
        openRequestModal()
      }
    }

    const currentImageIndex = computed(() => {
      if (!selectedImage.value) return -1
      return images.value.findIndex(img => img.uuid === selectedImage.value.uuid)
    })

    const canNavigatePrev = computed(() => {
      return currentImageIndex.value > 0
    })

    const canNavigateNext = computed(() => {
      return currentImageIndex.value >= 0 && currentImageIndex.value < images.value.length - 1
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
          response = await imagesApi.search(searchTerms, limit, offset.value, filters.value)
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

    const handleImageClick = (image, event) => {
      // In dedicated multi-select mode, always toggle selection
      if (isMultiSelectMode.value) {
        toggleImageSelection(image, event)
        return
      }

      // Desktop multi-select: Ctrl/Cmd+Click or Shift+Click
      const isCtrlOrCmd = event.ctrlKey || event.metaKey
      const isShift = event.shiftKey

      if (isCtrlOrCmd || isShift) {
        // Enter selection mode automatically
        event.preventDefault()
        toggleImageSelection(image, event)
        return
      }

      // Normal click - view image
      viewImage(image)
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

      // Scroll to the image in the grid
      scrollToCurrentImage(image.uuid)
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
        // Clear authentication when manually disabling hidden images mode
        if (clearHiddenAuth) {
          clearHiddenAuth()
        }
      }

      offset.value = 0
      hasMore.value = true
      fetchImages()
      fetchKeywords()
    }

    // Multi-select mode functions
    const toggleMultiSelectMode = () => {
      isMultiSelectMode.value = !isMultiSelectMode.value
      showMenu.value = false

      if (!isMultiSelectMode.value) {
        // Clear selection when exiting mode
        selectedImages.value.clear()
        lastSelectedIndex.value = -1
      } else {
        // Close requests panel when entering multi-select mode
        isPanelOpen.value = false
      }
    }

    const toggleImageSelection = (image, event) => {
      const imageIndex = images.value.findIndex(img => img.uuid === image.uuid)

      // Close requests panel when starting selection (if not in dedicated multi-select mode)
      if (!isMultiSelectMode.value && selectedImages.value.size === 0) {
        isPanelOpen.value = false
      }

      // Handle Shift+click for range selection/deselection
      // Only use range selection if there's a previous selection
      if (event.shiftKey && lastSelectedIndex.value !== -1 && selectedImages.value.size > 0) {
        const start = Math.min(lastSelectedIndex.value, imageIndex)
        const end = Math.max(lastSelectedIndex.value, imageIndex)

        // If the clicked image is already selected, deselect the range
        // Otherwise, select the range
        const shouldDeselect = selectedImages.value.has(image.uuid)

        for (let i = start; i <= end; i++) {
          if (shouldDeselect) {
            selectedImages.value.delete(images.value[i].uuid)
          } else {
            selectedImages.value.add(images.value[i].uuid)
          }
        }
      } else {
        // Toggle single selection
        if (selectedImages.value.has(image.uuid)) {
          selectedImages.value.delete(image.uuid)
        } else {
          selectedImages.value.add(image.uuid)
        }
      }

      lastSelectedIndex.value = imageIndex

      // Auto-clear lastSelectedIndex when all selections are cleared
      if (selectedImages.value.size === 0) {
        lastSelectedIndex.value = -1
      }
    }

    const selectedCount = computed(() => selectedImages.value.size)

    const navigateImage = (direction) => {
      const currentIndex = currentImageIndex.value
      let newIndex = currentIndex + direction

      // Don't wrap around - clamp to valid range
      if (newIndex < 0) return
      if (newIndex >= images.value.length) return

      const newImage = images.value[newIndex]
      if (newImage) {
        selectedImage.value = newImage
        // Update URL for bookmarking, but don't trigger route watcher
        router.replace(`/image/${newImage.uuid}`)

        // Scroll the grid to show the current image
        scrollToCurrentImage(newImage.uuid)
      }
    }

    const scrollToCurrentImage = (imageUuid) => {
      // Use nextTick to ensure the DOM has updated
      setTimeout(() => {
        if (!gridContainer.value) return

        // Find the image element in the grid
        const imageElements = gridContainer.value.querySelectorAll('.image-item')
        const imageIndex = images.value.findIndex(img => img.uuid === imageUuid)

        if (imageIndex !== -1 && imageElements[imageIndex]) {
          imageElements[imageIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          })
        }
      }, 50)
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
      try {
        await imagesApi.delete(imageId)
        images.value = images.value.filter(img => img.uuid !== imageId)
        selectedImage.value = null
        // Refresh keywords since counts and keywords may have changed
        fetchKeywords()
      } catch (error) {
        console.error('Error deleting image:', error)
        alert('Failed to delete image. Please try again.')
      }
    }

    // Batch action handlers
    const showBatchDeleteModal = ref(false)

    const batchDelete = async () => {
      showBatchDeleteModal.value = false

      try {
        const imageIds = Array.from(selectedImages.value)
        const deleteCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isTrashed: true })

        // Remove deleted images from the array
        images.value = images.value.filter(img => !selectedImages.value.has(img.uuid))

        // Update total count
        totalCount.value = Math.max(0, totalCount.value - deleteCount)

        // Clear selection and exit mode
        selectedImages.value.clear()
        isMultiSelectMode.value = false
        lastSelectedIndex.value = -1

        // Refresh keywords
        fetchKeywords()
      } catch (error) {
        console.error('Error batch deleting images:', error)
        alert('Failed to delete some images. Please try again.')
      }
    }

    const batchFavorite = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        await imagesApi.batchUpdate(imageIds, { isFavorite: true })

        // Update images in the array
        images.value.forEach(img => {
          if (selectedImages.value.has(img.uuid)) {
            img.is_favorite = 1
          }
        })

        // Clear selection
        selectedImages.value.clear()
        lastSelectedIndex.value = -1

        fetchKeywords()
      } catch (error) {
        console.error('Error batch favoriting images:', error)
        alert('Failed to favorite some images. Please try again.')
      }
    }

    const batchUnfavorite = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isFavorite: false })

        // Update images in the array, or remove if in favorites-only view
        if (filters.value.showFavoritesOnly) {
          images.value = images.value.filter(img => !selectedImages.value.has(img.uuid))
          totalCount.value = Math.max(0, totalCount.value - removeCount)
        } else {
          images.value.forEach(img => {
            if (selectedImages.value.has(img.uuid)) {
              img.is_favorite = 0
            }
          })
        }

        // Clear selection
        selectedImages.value.clear()
        lastSelectedIndex.value = -1

        fetchKeywords()
      } catch (error) {
        console.error('Error batch unfavoriting images:', error)
        alert('Failed to unfavorite some images. Please try again.')
      }
    }

    const batchHide = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isHidden: true })

        // Update images in the array, or remove if not showing hidden
        if (!filters.value.showHidden) {
          images.value = images.value.filter(img => !selectedImages.value.has(img.uuid))
          totalCount.value = Math.max(0, totalCount.value - removeCount)
        } else {
          images.value.forEach(img => {
            if (selectedImages.value.has(img.uuid)) {
              img.is_hidden = 1
            }
          })
        }

        // Clear selection
        selectedImages.value.clear()
        lastSelectedIndex.value = -1

        fetchKeywords()
      } catch (error) {
        console.error('Error batch hiding images:', error)
        alert('Failed to hide some images. Please try again.')
      }
    }

    const batchUnhide = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isHidden: false })

        // Update images in the array, or remove if in hidden-only view
        if (filters.value.showHidden && !filters.value.showFavoritesOnly) {
          images.value = images.value.filter(img => !selectedImages.value.has(img.uuid))
          totalCount.value = Math.max(0, totalCount.value - removeCount)
        } else {
          images.value.forEach(img => {
            if (selectedImages.value.has(img.uuid)) {
              img.is_hidden = 0
            }
          })
        }

        // Clear selection
        selectedImages.value.clear()
        lastSelectedIndex.value = -1

        fetchKeywords()
      } catch (error) {
        console.error('Error batch unhiding images:', error)
        alert('Failed to unhide some images. Please try again.')
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

    // Albums modal functions
    const toggleAlbumsModal = () => {
      isAlbumsModalOpen.value = !isAlbumsModalOpen.value
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
        // Only restore showHidden if user still has authentication
        if (checkHiddenAuth && checkHiddenAuth()) {
          filters.value.showHidden = true
        } else {
          // Clear sessionStorage if no longer authenticated
          sessionStorage.removeItem('showHidden')
        }
      }
    }

    const selectKeyword = (keyword) => {
      // Update filters based on keyword selection
      filters.value.requestId = null

      // Check if this keyword album has multiple keywords (grouped keywords)
      if (keyword.keywords && Array.isArray(keyword.keywords)) {
        // Multi-keyword group - replace all keywords
        // Check if all cluster keywords are already in the filter (exact match)
        const allPresent = keyword.keywords.every(kw =>
          filters.value.keywords.includes(kw)
        ) && filters.value.keywords.length === keyword.keywords.length

        if (allPresent) {
          // Clear all keywords if this is already the active filter (toggle off)
          filters.value.keywords = []
        } else {
          // Replace with this group's keywords
          filters.value.keywords = [...keyword.keywords]
        }
      } else if (keyword.id.startsWith('keyword:')) {
        // Single keyword album - replace keywords
        const keywordText = keyword.id.replace('keyword:', '').split('+')[0] // Get first keyword from ID

        // Check if this is the only keyword in the filter
        if (filters.value.keywords.length === 1 && filters.value.keywords[0] === keywordText) {
          // Clear if already the active filter (toggle off)
          filters.value.keywords = []
        } else {
          // Replace with this keyword
          filters.value.keywords = [keywordText]
        }
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
      canNavigatePrev,
      canNavigateNext,
      galleryTitle,
      gridContainer,
      filters,
      searchQuery,
      getThumbnailUrl,
      formatDate,
      handleImageClick,
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
      // Albums modal
      isAlbumsModalOpen,
      toggleAlbumsModal,
      keywords,
      selectKeyword,
      // Menu and filters
      showMenu,
      menuContainer,
      toggleFavorites,
      toggleMenu,
      toggleHiddenImages,
      checkHiddenAuth,
      // Multi-select mode
      isMultiSelectMode,
      selectedImages,
      selectedCount,
      toggleMultiSelectMode,
      toggleImageSelection,
      showBatchDeleteModal,
      batchDelete,
      batchFavorite,
      batchUnfavorite,
      batchHide,
      batchUnhide
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
  background: var(--color-bg-base);
  z-index: 50;
  transition: top 0.3s ease-out;
}

.library-view.panel-open .header {
  /* No longer pushing header down */
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem 2rem;
}

.header-row-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header-row-2 {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid #2a2a2a;
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
  color: var(--color-text-tertiary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-albums-toggle:hover {
  background: var(--color-surface);
  border-color: var(--color-text-disabled);
  color: var(--color-text-primary);
}


.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
}

.filter-chips-container {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #444 transparent;
}

.filter-chips-container::-webkit-scrollbar {
  height: 6px;
}

.filter-chips-container::-webkit-scrollbar-track {
  background: transparent;
}

.filter-chips-container::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.filter-chips-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.filter-chips {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-bottom: 0.25rem;
  flex-wrap: nowrap;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid #333;
  border-radius: 16px;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.chip-remove {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin-left: 0.25rem;
  transition: color 0.2s;
}

.chip-remove:hover {
  color: var(--color-danger);
}

.btn-clear-filters {
  padding: 0.4rem 0.75rem;
  background: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: 16px;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
}

.btn-clear-filters:hover {
  background: #d32f2f;
  border-color: #d32f2f;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  border: 1px solid #333;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  width: 250px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-disabled);
}

.btn-search {
  padding: 0.5rem 1rem;
  background: var(--color-primary);
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
  background: var(--color-primary-hover);
}

.btn-favorites-toggle {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid #333;
  color: var(--color-text-tertiary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-favorites-toggle:hover {
  background: var(--color-surface);
  border-color: var(--color-text-disabled);
  color: var(--color-warning);
}

.btn-favorites-toggle.active {
  background: var(--color-surface);
  border-color: var(--color-warning);
  color: var(--color-warning);
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
  color: var(--color-text-tertiary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-menu:hover {
  background: var(--color-surface);
  border-color: var(--color-text-disabled);
  color: var(--color-text-primary);
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: var(--color-surface);
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
  color: var(--color-text-primary);
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: var(--color-surface-hover);
}

.menu-item i {
  width: 20px;
  color: var(--color-text-tertiary);
}

.loading,
.loading-more {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--color-text-tertiary);
}

.loading-more {
  padding: 2rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--color-text-disabled);
}

.empty-state p {
  margin-bottom: 0.5rem;
}

.empty-state .hint {
  font-size: 0.9rem;
  color: var(--color-border-lighter);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px;
  background: var(--color-bg-base);
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  background: var(--color-surface);
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
  background: var(--overlay-darker);
  color: var(--color-warning);
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
  background: var(--overlay-darker);
  color: var(--color-text-tertiary);
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
  background: var(--overlay-darkest);
  color: var(--color-text-tertiary);
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
  background: var(--overlay-modal);
  color: var(--color-gray-300);
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

/* Multi-select mode styles */
.image-item.multi-select-mode {
  cursor: default;
}

.image-item.multi-select-mode:hover img {
  transform: none;
}

.image-item.selected {
  outline: 3px solid var(--color-primary);
  outline-offset: -3px;
}

.selection-checkbox {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  z-index: 3;
  pointer-events: none;
}

.checkbox {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--overlay-darker);
  border: 2px solid var(--color-border-lighter);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.checkbox i {
  color: white;
  font-size: 1rem;
}

.image-info {
  color: var(--color-text-primary);
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
  background: var(--color-primary);
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
  background: var(--color-border-lighter);
}

.fab:hover {
  background: var(--color-primary-hover);
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
}

.fab-settings:hover {
  background: var(--color-text-quaternary);
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

/* Multi-Select Action Bar */
.multi-select-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
  z-index: 45;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
}

.action-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  gap: 1rem;
  max-width: 100%;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.selection-info .count {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-action:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-lighter);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action i {
  font-size: 1rem;
}

.btn-action.btn-cancel {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.btn-action.btn-cancel:hover {
  background: var(--color-bg-secondary);
}

.btn-action.btn-delete {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: white;
}

.btn-action.btn-delete:hover:not(:disabled) {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

.btn-action.btn-favorite {
  color: var(--color-warning);
}

.btn-action.btn-hide {
  color: var(--color-text-tertiary);
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
  background: var(--color-bg-tertiary);
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
  background: var(--color-warning-hover);
  animation: pulse 2s infinite;
}

.status-dot.error {
  background: var(--color-danger-ios);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tab-text {
  font-size: 0.95rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

/* Requests Panel */
.requests-panel {
  position: fixed;
  bottom: 0;
  top: auto;
  left: 0;
  right: 0;
  background: var(--color-bg-tertiary);
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
  background: var(--color-bg-tertiary);
  position: relative;
}

.btn-clear-history {
  width: 100%;
  padding: 1rem;
  background: var(--color-surface-hover);
  border: 1px solid #444;
  border-radius: 8px;
  color: var(--color-text-tertiary);
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
  border-color: var(--color-danger-hover);
  color: var(--color-danger-hover);
}

.btn-clear-history:active {
  transform: scale(0.98);
}

.panel-empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--color-text-disabled);
}

.panel-empty-state p {
  margin-bottom: 0.5rem;
}

.panel-empty-state .hint {
  font-size: 0.9rem;
  color: var(--color-border-lighter);
}

.requests-grid {
  display: grid;
  gap: 1rem;
}

.request-card-item:not(:last-child) {
  border-bottom: 1px solid #333;
  padding-bottom: 1rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .header-row-1 {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .header-left {
    order: 1;
  }

  .header-controls {
    order: 2;
    justify-content: center;
  }

  .search-bar {
    flex: 1;
  }

  .search-input {
    flex: 1;
    width: auto;
  }

  .header-row-2 {
    order: 3;
  }
}

</style>
