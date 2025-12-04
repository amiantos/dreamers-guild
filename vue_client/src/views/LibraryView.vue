<template>
  <div class="library-view" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'action-bar-open': selectedCount > 0 || isMultiSelectMode }">
    <!-- Sidebar -->
    <Transition name="mobile-menu">
      <LibrarySidebar
        v-if="!isMobile || isMobileMenuOpen"
        ref="sidebarRef"
        :activeView="sidebarActiveView"
        :activeAlbumSlug="sidebarActiveAlbumSlug"
        :isAuthenticated="isHiddenAuthenticated"
        :isMobileMenuOpen="isMobileMenuOpen"
        @navigate="handleSidebarNavigate"
        @create-album="handleCreateAlbum"
        @close="closeMobileMenu"
        @view-request-images="handleViewRequestImages"
      />
    </Transition>

    <!-- Create Album Modal -->
    <CreateAlbumModal
      :isOpen="isCreateAlbumModalOpen"
      @close="closeCreateAlbumModal"
      @created="handleAlbumCreated"
    />

    <!-- Add to Album Modal -->
    <AddToAlbumModal
      :isOpen="isAddToAlbumModalOpen"
      :imageIds="Array.from(selectedImages)"
      :includeHidden="isHiddenAuthenticated"
      @close="closeAddToAlbumModal"
      @added="handleAddedToAlbum"
    />

    <DeleteRequestModal
      v-if="deleteModalVisible"
      :request="requestToDelete"
      @close="closeDeleteModal"
      @delete="confirmDelete"
    />

    <DeleteAllRequestsModal
      v-if="deleteAllModalVisible"
      :requests="deletableRequests"
      @close="closeDeleteAllModal"
      @delete="confirmDeleteAll"
    />

    <BatchDeleteModal
      v-if="showBatchDeleteModal"
      :count="deletableSelectedImages.length"
      :skipped-count="skippedFavoriteCount"
      @close="showBatchDeleteModal = false"
      @delete="batchDelete"
    />

    <div class="header">
      <div class="header-content">
        <div class="header-row-1">
          <div class="header-left">
            <span
              v-if="(isMobile || sidebarCollapsed) && requests.length > 0"
              class="header-status-dot"
              :class="requestStatusClass"
              title="Request status"
            ></span>
            <button
              v-if="isMobile || sidebarCollapsed"
              @click="handleHamburgerClick"
              class="btn-hamburger"
              aria-label="Open menu"
            >
              <i class="fa-solid fa-bars"></i>
            </button>
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

            <!-- Overflow Menu -->
            <div class="menu-container" ref="menuContainer">
              <button @click="toggleMenu" class="btn-menu" title="More options" aria-label="More options">
                <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
              </button>
              <div v-if="showMenu" class="menu-dropdown">
                <div class="menu-item" @click="toggleMultiSelectMode">
                  <i class="fa-solid fa-check-double" aria-hidden="true"></i>
                  <span>Multi-Select Mode</span>
                </div>
                <div class="menu-item" @click="toggleHiddenImages">
                  <i class="fa-solid" :class="isHiddenAuthenticated ? 'fa-eye' : 'fa-eye-slash'" aria-hidden="true"></i>
                  <span>{{ isHiddenAuthenticated ? 'Hide Hidden' : 'Show Hidden' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Filters Row -->
        <div v-if="filters.requestId || filters.keywords.length > 0 || filters.filterCriteria.length > 0" class="header-row-2">
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
              <div v-for="(criterion, index) in filters.filterCriteria" :key="'criterion-' + index" class="filter-chip" :class="'filter-chip-' + criterion.type">
                <span>{{ formatFilterChip(criterion) }}</span>
                <button @click="clearFilter('filterCriteria', criterion)" class="chip-remove" :aria-label="'Remove ' + criterion.value + ' filter'">×</button>
              </div>
            </div>
          </div>
          <!-- Clear All Button -->
          <button v-if="totalFilterCount > 1" @click="clearAllFilters" class="btn-clear-filters" title="Clear all filters">
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
          <button @click="handleAddToAlbum" :disabled="selectedCount === 0" class="btn-action btn-album" title="Add to Album">
            <i class="fa-solid fa-folder-plus"></i>
            <span>Album</span>
          </button>
          <button v-if="currentAlbum" @click="batchRemoveFromAlbum" :disabled="selectedCount === 0" class="btn-action btn-remove-album" title="Remove from Album">
            <i class="fa-solid fa-folder-minus"></i>
            <span>Remove</span>
          </button>
          <button @click="batchHide" :disabled="selectedCount === 0" class="btn-action btn-hide" title="Hide">
            <i class="fa-solid fa-eye-slash"></i>
            <span>Hide</span>
          </button>
          <button @click="batchUnhide" :disabled="selectedCount === 0" class="btn-action btn-unhide" title="Unhide">
            <i class="fa-solid fa-eye"></i>
            <span>Unhide</span>
          </button>
          <button @click="showBatchDeleteModal = true" :disabled="deletableSelectedImages.length === 0" class="btn-action btn-delete" title="Delete">
            <i class="fa-solid fa-trash"></i>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { imagesApi, requestsApi, albumsApi } from '@api'
import { useImagePolling } from '../composables/useImagePolling.js'
import { useToast } from '../composables/useToast.js'
import { useAuthStore } from '../stores/authStore.js'
import { useAlbumStore } from '../stores/albumStore.js'
import { useUiStore } from '../stores/uiStore.js'
import { useRequestsStore } from '../stores/requestsStore.js'
import ImageModal from '../components/ImageModal.vue'
import DeleteRequestModal from '../components/DeleteRequestModal.vue'
import DeleteAllRequestsModal from '../components/DeleteAllRequestsModal.vue'
import BatchDeleteModal from '../components/BatchDeleteModal.vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import CreateAlbumModal from '../components/CreateAlbumModal.vue'
import AddToAlbumModal from '../components/AddToAlbumModal.vue'
import AsyncImage from '../components/AsyncImage.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal,
    DeleteRequestModal,
    DeleteAllRequestsModal,
    BatchDeleteModal,
    LibrarySidebar,
    CreateAlbumModal,
    AddToAlbumModal,
    AsyncImage
  },
  props: {
    imageId: String, // selected image ID from URL
    albumSlug: String // album slug from URL
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    const { showToast } = useToast()
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
      filterCriteria: [] // Flexible filter criteria from albums [{type, value}]
    })
    const routeBeforeModal = ref(null) // Store route before opening modal

    // Sidebar ref for component access
    const sidebarRef = ref(null)

    // Requests Store
    const requestsStore = useRequestsStore()
    const {
      requests,
      queueStatus,
      deleteModalVisible,
      deleteAllModalVisible,
      requestToDelete,
      deletableRequests
    } = storeToRefs(requestsStore)

    // UI Store for centralized UI state
    const uiStore = useUiStore()
    const {
      sidebarCollapsed,
      showMenu,
      modals
    } = storeToRefs(uiStore)

    // Computed for template binding to modal states
    const isCreateAlbumModalOpen = computed(() => modals.value.createAlbum)
    const isAddToAlbumModalOpen = computed(() => modals.value.addToAlbum)

    // Mobile menu state
    const isMobileMenuOpen = ref(false)
    const menuRouteBeforeOpen = ref(null)
    const isMobile = ref(window.innerWidth < 768)

    // Update isMobile on resize
    const updateIsMobile = () => {
      isMobile.value = window.innerWidth < 768
      // Close mobile menu if screen becomes desktop
      if (!isMobile.value && isMobileMenuOpen.value) {
        isMobileMenuOpen.value = false
        menuRouteBeforeOpen.value = null
      }
    }

    // Helper to extract view from a path
    const getViewFromPath = (path) => {
      if (path.startsWith('/favorites')) return 'favorites'
      if (path.startsWith('/hidden-favorites')) return 'hidden-favorites'
      if (path.startsWith('/hidden')) return 'hidden'
      if (path.startsWith('/album/')) return 'album'
      return 'library'
    }

    // Current view based on route (uses stored route when modal/menu is open to prevent refetch)
    const currentView = computed(() => {
      // When mobile menu is open, use the stored route to prevent gallery from changing
      if (isMobileMenuOpen.value && menuRouteBeforeOpen.value) {
        return getViewFromPath(menuRouteBeforeOpen.value.path)
      }
      // When image modal is open, use the stored route to maintain correct view context
      // This prevents polling from fetching wrong images (e.g., library images while viewing hidden)
      if (routeBeforeModal.value) {
        return getViewFromPath(routeBeforeModal.value.path)
      }
      return getViewFromPath(route.path)
    })

    // For sidebar: same logic (kept as alias for clarity)
    const sidebarActiveView = computed(() => currentView.value)

    const sidebarActiveAlbumSlug = computed(() => {
      if (isMobileMenuOpen.value && menuRouteBeforeOpen.value) {
        const path = menuRouteBeforeOpen.value.path
        const match = path.match(/^\/album\/([^/]+)/)
        return match ? match[1] : null
      }
      // When image modal is open, check the stored route for album context
      if (routeBeforeModal.value) {
        const path = routeBeforeModal.value.path
        const match = path.match(/^\/album\/([^/]+)/)
        return match ? match[1] : null
      }
      return currentAlbum.value?.slug || null
    })

    // View-based flags derived from currentView
    const isHiddenView = computed(() =>
      currentView.value === 'hidden' || currentView.value === 'hidden-favorites'
    )
    const isFavoritesView = computed(() =>
      currentView.value === 'favorites' || currentView.value === 'hidden-favorites'
    )

    // Album store for centralized album state
    const albumStore = useAlbumStore()
    const { currentAlbum } = storeToRefs(albumStore)

    // Menu container ref for click outside handling
    const menuContainer = ref(null)

    // Multi-select mode state
    const isMultiSelectMode = ref(false)
    const selectedImages = ref(new Set())
    const lastSelectedIndex = ref(-1)

    // Initialize image polling composable
    const imagePolling = useImagePolling({
      filters,
      images,
      totalCount,
      currentView,
      currentAlbum,
      onPollComplete: () => {
        // Refresh albums from server to get latest counts
        albumStore.loadAlbums(isAuthenticated.value)
      }
    })

    // Inject functions from App.vue (non-auth)
    const loadSettingsFromImage = inject('loadSettingsFromImage')
    const openRequestModal = inject('openRequestModal')
    const shouldOpenRequestsPanel = inject('shouldOpenRequestsPanel')

    // Use auth store instead of inject
    const authStore = useAuthStore()
    const { isAuthenticated } = storeToRefs(authStore)

    // Auth functions from store
    const checkHiddenAuth = () => authStore.checkHiddenAuth()
    const requestHiddenAccess = (callback) => authStore.requestHiddenAccess(callback)
    const clearHiddenAuth = () => authStore.clearAuth()

    // Computed property for reactive auth state
    const isHiddenAuthenticated = computed(() => isAuthenticated.value)

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
      const suffix = count !== 1 ? 's' : ''

      if (currentView.value === 'favorites') {
        return `${count} Favorite${suffix}`
      } else if (currentView.value === 'hidden-favorites') {
        return `${count} Hidden Favorite${suffix}`
      } else if (currentView.value === 'hidden') {
        return `${count} Hidden Image${suffix}`
      } else if (currentView.value === 'album' && currentAlbum.value) {
        return `${currentAlbum.value.title} (${count})`
      }
      return `${count} Image${suffix}`
    })

    const totalFilterCount = computed(() => {
      let count = 0
      if (filters.value.requestId) count++
      count += filters.value.keywords.length
      count += filters.value.filterCriteria.length
      return count
    })

    const formatFilterChip = (criterion) => {
      switch (criterion.type) {
        case 'lora_id':
          // Try to show a friendly name if it's a numeric ID
          if (/^\d+$/.test(criterion.value)) {
            return `LoRA: #${criterion.value}`
          }
          return `LoRA: ${criterion.value}`
        case 'model':
          return `Model: ${criterion.value}`
        case 'keyword':
          return criterion.value
        case 'request_id':
          return `Request: ${criterion.value.substring(0, 8)}`
        default:
          return criterion.value
      }
    }

    const fetchImages = async (append = false) => {
      if (!hasMore.value && append) return

      try {
        loading.value = true
        let response

        // Build API options from filters and view state
        const apiOptions = {
          ...filters.value,
          showFavoritesOnly: isFavoritesView.value,
          showHidden: isHiddenView.value
        }

        if (filters.value.requestId) {
          response = await imagesApi.getByRequestId(filters.value.requestId, limit)
          hasMore.value = false // Request images don't paginate
        } else if (filters.value.filterCriteria.length > 0) {
          // Use flexible filter criteria (from album selection)
          response = await imagesApi.getAll(limit, offset.value, apiOptions)
        } else if (filters.value.keywords.length > 0) {
          // Join keywords with comma for search (supports AND filtering)
          const searchTerms = filters.value.keywords.join(',')
          response = await imagesApi.search(searchTerms, limit, offset.value, apiOptions)
        } else {
          response = await imagesApi.getAll(limit, offset.value, apiOptions)
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
      // Use currentAlbum as source of truth (persists when ImageModal changes route)
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        if (currentAlbum.value) {
          fetchAlbumImages(true)
        } else {
          fetchImages(true)
        }
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
      fetchForCurrentView()
    }

    const clearFilter = (filterType, value = null) => {
      if (filterType === 'keywords' && value) {
        // Remove specific keyword from array
        filters.value.keywords = filters.value.keywords.filter(k => k !== value)
      } else if (filterType === 'keywords') {
        // Clear all keywords
        filters.value.keywords = []
      } else if (filterType === 'filterCriteria' && value) {
        // Remove specific criterion from array (match by type and value)
        filters.value.filterCriteria = filters.value.filterCriteria.filter(
          c => !(c.type === value.type && c.value === value.value)
        )
      } else if (filterType === 'filterCriteria') {
        // Clear all filter criteria
        filters.value.filterCriteria = []
      } else {
        filters.value[filterType] = null
      }
      offset.value = 0
      hasMore.value = true
      fetchForCurrentView()
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
        fetchForCurrentView()
        updateFilterUrl()
      }
    }

    const clearAllFilters = () => {
      filters.value.requestId = null
      filters.value.keywords = []
      filters.value.filterCriteria = []
      // Note: Don't clear showFavoritesOnly or showHidden - those are view toggles, not search filters
      searchQuery.value = ''
      offset.value = 0
      hasMore.value = true
      fetchForCurrentView()
      updateFilterUrl()
    }

    const toggleMenu = () => {
      uiStore.toggleMenu()
    }

    const toggleHiddenImages = () => {
      uiStore.closeMenu()

      if (!isHiddenAuthenticated.value) {
        // Enabling hidden mode - sidebar watches auth state and refreshes automatically
        if (requestHiddenAccess) {
          requestHiddenAccess(() => {
            // Auth successful - hidden content now visible
          })
        }
      } else {
        // Disabling hidden mode
        if (clearHiddenAuth) {
          clearHiddenAuth()
        }
        // If on a hidden-specific view or a hidden album, go back to library
        const isOnHiddenView = currentView.value === 'hidden' || currentView.value === 'hidden-favorites'
        const isOnHiddenAlbum = currentView.value === 'album' && currentAlbum.value?.is_hidden
        if (isOnHiddenView || isOnHiddenAlbum) {
          router.push('/')
        }
      }
    }

    // Multi-select mode functions
    const toggleMultiSelectMode = () => {
      isMultiSelectMode.value = !isMultiSelectMode.value
      uiStore.closeMenu()

      if (!isMultiSelectMode.value) {
        // Clear selection when exiting mode
        selectedImages.value.clear()
        lastSelectedIndex.value = -1
      } else {
        // Close requests panel when entering multi-select mode
        uiStore.closePanel()
      }
    }

    const toggleImageSelection = (image, event) => {
      const imageIndex = images.value.findIndex(img => img.uuid === image.uuid)

      // Close requests panel when starting selection (if not in dedicated multi-select mode)
      if (!isMultiSelectMode.value && selectedImages.value.size === 0) {
        uiStore.closePanel()
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

    const deletableSelectedImages = computed(() => {
      return images.value.filter(img =>
        selectedImages.value.has(img.uuid) && !img.is_favorite
      )
    })

    const skippedFavoriteCount = computed(() => {
      return images.value.filter(img =>
        selectedImages.value.has(img.uuid) && img.is_favorite
      ).length
    })

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

    // Navigate to next image after removing one from the list
    // Call this AFTER the image has been removed from images.value
    const navigateAfterRemoval = (removedIndex) => {
      if (images.value.length === 0) {
        closeImage()
      } else {
        let newIndex = removedIndex
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

    const deleteImage = async (imageId) => {
      try {
        const imageIndex = images.value.findIndex(img => img.uuid === imageId)
        const wasSelected = selectedImage.value?.uuid === imageId

        await imagesApi.delete(imageId)
        images.value = images.value.filter(img => img.uuid !== imageId)

        if (wasSelected) {
          navigateAfterRemoval(imageIndex)
        }
      } catch (error) {
        console.error('Error deleting image:', error)
        showToast('Failed to delete image. Please try again.', 'error')
      }
    }

    // Batch action handlers
    const showBatchDeleteModal = ref(false)

    const batchDelete = async () => {
      showBatchDeleteModal.value = false

      try {
        // Only delete non-favorited images
        const imageIds = deletableSelectedImages.value.map(img => img.uuid)

        if (imageIds.length === 0) {
          // All selected images are favorites, nothing to delete
          selectedImages.value.clear()
          isMultiSelectMode.value = false
          return
        }

        const deleteCount = imageIds.length
        await imagesApi.batchDelete(imageIds)

        // Remove deleted images from the array
        const deletedSet = new Set(imageIds)
        images.value = images.value.filter(img => !deletedSet.has(img.uuid))

        // Update total count
        totalCount.value = Math.max(0, totalCount.value - deleteCount)

        // Clear selection and exit mode
        selectedImages.value.clear()
        isMultiSelectMode.value = false
        lastSelectedIndex.value = -1
      } catch (error) {
        console.error('Error batch deleting images:', error)
        showToast('Failed to delete some images. Please try again.', 'error')
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
      } catch (error) {
        console.error('Error batch favoriting images:', error)
        showToast('Failed to favorite some images. Please try again.', 'error')
      }
    }

    const batchUnfavorite = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isFavorite: false })

        // Update images in the array, or remove if in favorites view
        if (isFavoritesView.value) {
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
      } catch (error) {
        console.error('Error batch unfavoriting images:', error)
        showToast('Failed to unfavorite some images. Please try again.', 'error')
      }
    }

    const batchHide = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isHidden: true })

        // Update images in the array, or remove if not in hidden view
        if (!isHiddenView.value) {
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
      } catch (error) {
        console.error('Error batch hiding images:', error)
        showToast('Failed to hide some images. Please try again.', 'error')
      }
    }

    const batchUnhide = async () => {
      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length

        await imagesApi.batchUpdate(imageIds, { isHidden: false })

        // Update images in the array, or remove if in hidden-only view (not hidden-favorites)
        if (currentView.value === 'hidden') {
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
      } catch (error) {
        console.error('Error batch unhiding images:', error)
        showToast('Failed to unhide some images. Please try again.', 'error')
      }
    }

    const batchRemoveFromAlbum = async () => {
      if (!currentAlbum.value) return

      try {
        const imageIds = Array.from(selectedImages.value)
        const removeCount = imageIds.length
        const albumId = currentAlbum.value.id

        // Bulk remove images from the album
        await albumsApi.removeImages(albumId, imageIds)

        // Remove from current view
        images.value = images.value.filter(img => !selectedImages.value.has(img.uuid))
        totalCount.value = Math.max(0, totalCount.value - removeCount)

        // Update album count in store (reactive update to sidebar)
        albumStore.updateAlbumCount(albumId, -removeCount)

        // Clear selection
        selectedImages.value.clear()
        lastSelectedIndex.value = -1

        showToast(`Removed ${removeCount} image(s) from album`, 'success')
      } catch (error) {
        console.error('Error removing images from album:', error)
        showToast('Failed to remove some images from album', 'error')
      }
    }

    const handleLoadSettings = (includeSeed) => {
      if (selectedImage.value && loadSettingsFromImage) {
        loadSettingsFromImage(selectedImage.value, includeSeed, currentAlbum.value?.slug)
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
            // Image was hidden and we're NOT in hidden view
            (updates.is_hidden === 1 && !isHiddenView.value) ||
            // Image was unhidden and we ARE in hidden view
            (updates.is_hidden === 0 && isHiddenView.value)
          )

          if (shouldRemove) {
            images.value.splice(imageIndex, 1)

            if (selectedImage.value && selectedImage.value.uuid === updates.uuid) {
              navigateAfterRemoval(imageIndex)
            }
          }
        } else if ('is_favorite' in updates) {
          const shouldRemove = (
            (updates.is_favorite === 0 && isFavoritesView.value)
          )

          if (shouldRemove) {
            images.value.splice(imageIndex, 1)

            if (selectedImage.value && selectedImage.value.uuid === updates.uuid) {
              navigateAfterRemoval(imageIndex)
            }
          }
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
    const viewRequestImages = (requestId) => {
      // Navigate to library view with request filter
      router.push({ path: '/', query: { request: requestId } })
    }

    const showDeleteModal = (requestId) => {
      const request = requests.value.find(r => r.uuid === requestId)
      if (request) {
        requestsStore.showDeleteModal(request)
      }
    }

    const handleRetry = async (requestId) => {
      try {
        await requestsStore.retryRequest(requestId)
      } catch (error) {
        showToast('Failed to retry request. Please try again.', 'error')
      }
    }

    const confirmDelete = async (imageAction) => {
      try {
        await requestsStore.confirmDelete(imageAction)
        // Refresh the image library to reflect deleted images
        offset.value = 0
        hasMore.value = true
        await fetchImages()
      } catch (error) {
        showToast('Failed to delete request. Please try again.', 'error')
      }
    }

    const showDeleteAllModal = () => {
      requestsStore.showDeleteAllModal()
    }

    const closeDeleteModal = () => {
      requestsStore.closeDeleteModal()
    }

    const closeDeleteAllModal = () => {
      requestsStore.closeDeleteAllModal()
    }

    const confirmDeleteAll = async (imageAction) => {
      try {
        await requestsStore.confirmDeleteAll(imageAction)
        // Refresh the image library to reflect deleted images
        offset.value = 0
        hasMore.value = true
        await fetchImages()
      } catch (error) {
        showToast('Failed to delete requests. Please try again.', 'error')
      }
    }

    // Mobile menu methods
    const openMobileMenu = () => {
      // Store current route before opening (same pattern as ImageModal)
      menuRouteBeforeOpen.value = {
        path: route.path,
        query: { ...route.query }
      }
      isMobileMenuOpen.value = true
      router.replace('/menu')
    }

    const handleHamburgerClick = () => {
      if (isMobile.value) {
        openMobileMenu()
      } else {
        // Desktop: just expand the sidebar
        uiStore.setSidebarCollapsed(false)
      }
    }

    const closeMobileMenu = () => {
      isMobileMenuOpen.value = false
      // Restore previous route
      if (menuRouteBeforeOpen.value) {
        router.replace({
          path: menuRouteBeforeOpen.value.path,
          query: menuRouteBeforeOpen.value.query
        })
        menuRouteBeforeOpen.value = null
      } else {
        router.replace('/')
      }
    }

    // Sidebar handlers
    const handleSidebarNavigate = ({ view, albumSlug }) => {
      // Close mobile menu first (if open)
      if (isMobileMenuOpen.value) {
        isMobileMenuOpen.value = false
        menuRouteBeforeOpen.value = null  // Don't restore, we're navigating to new route
      }

      // Navigate based on view
      if (view === 'library') {
        router.push('/')
      } else if (view === 'favorites') {
        router.push('/favorites')
      } else if (view === 'hidden') {
        router.push('/hidden')
      } else if (view === 'hidden-favorites') {
        router.push('/hidden-favorites')
      } else if (view === 'album' && albumSlug) {
        router.push(`/album/${albumSlug}`)
      }
    }

    const handleViewRequestImages = (requestId) => {
      // Close mobile menu first (if open) - must be before navigation
      if (isMobileMenuOpen.value) {
        isMobileMenuOpen.value = false
        menuRouteBeforeOpen.value = null  // Don't restore, we're navigating to new route
      }
      // Navigate to library filtered by request
      router.push({ path: '/', query: { request: requestId } })
    }

    const handleCreateAlbum = () => {
      uiStore.openModal('createAlbum')
    }

    const closeCreateAlbumModal = () => {
      uiStore.closeModal('createAlbum')
    }

    const handleAlbumCreated = (album) => {
      // Store already updated by CreateAlbumModal, just navigate
      router.push(`/album/${album.slug}`)
    }

    const handleAddToAlbum = () => {
      uiStore.openModal('addToAlbum')
    }

    const closeAddToAlbumModal = () => {
      uiStore.closeModal('addToAlbum')
    }

    const handleAddedToAlbum = () => {
      // Store already updated by AddToAlbumModal, just clear selection
      selectedImages.value.clear()
      lastSelectedIndex.value = -1
      isMultiSelectMode.value = false
    }

    // Load album info when viewing an album
    const loadCurrentAlbum = async () => {
      if (props.albumSlug) {
        await albumStore.loadCurrentAlbum(props.albumSlug)
      } else {
        albumStore.setCurrentAlbum(null)
      }
    }

    // Fetch album images
    const fetchAlbumImages = async (append = false) => {
      if (!currentAlbum.value || (!hasMore.value && append)) return

      try {
        loading.value = true
        // For album view, don't filter by hidden status - show all images in the album
        const response = await albumsApi.getImages(
          currentAlbum.value.id,
          limit,
          offset.value,
          {
            showFavorites: isFavoritesView.value,
            keywords: filters.value.keywords
          }
        )

        const newImages = response.data.images || []
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
        console.error('Error fetching album images:', error)
        totalCount.value = 0
      } finally {
        loading.value = false
      }
    }

    // Helper to fetch based on current view
    // Use currentAlbum as source of truth (persists when ImageModal changes route)
    const fetchForCurrentView = (append = false) => {
      if (currentAlbum.value) {
        return fetchAlbumImages(append)
      } else {
        return fetchImages(append)
      }
    }

    const updateFilterUrl = () => {
      // Build query params
      const query = {}

      if (filters.value.keywords.length > 0) {
        query.q = filters.value.keywords.join(',')
      }

      // Add request ID (check both direct filter and filterCriteria)
      if (filters.value.requestId) {
        query.request = filters.value.requestId
      }

      // Add filterCriteria to URL params
      for (const criterion of filters.value.filterCriteria) {
        switch (criterion.type) {
          case 'lora_id':
            // Support multiple loras as comma-separated
            if (query.lora) {
              query.lora += ',' + criterion.value
            } else {
              query.lora = criterion.value
            }
            break
          case 'model':
            query.model = criterion.value
            break
          case 'keyword':
            // Add to keywords (q param)
            if (query.q) {
              query.q += ',' + criterion.value
            } else {
              query.q = criterion.value
            }
            break
          case 'request_id':
            query.request = criterion.value
            break
        }
      }

      // Update URL without triggering navigation - preserve current view path
      const currentPath = route.path.includes('/image/') ? '/' : route.path
      if (currentPath === '/favorites' || currentPath === '/hidden' || currentPath.startsWith('/album/')) {
        router.replace({ path: currentPath, query })
      } else {
        router.replace({ path: '/', query })
      }
    }

    const loadFiltersFromUrl = () => {
      // Reset filters
      filters.value.keywords = []
      filters.value.requestId = null
      filters.value.filterCriteria = []

      // Load keywords from query params
      if (route.query.q) {
        const queryKeywords = route.query.q.split(',').filter(k => k.trim().length > 0)
        filters.value.keywords = queryKeywords
      }

      // Load request ID from URL
      if (route.query.request) {
        filters.value.requestId = route.query.request
      }

      // Load lora filter(s) from URL
      if (route.query.lora) {
        const loraIds = route.query.lora.split(',').filter(l => l.trim().length > 0)
        for (const loraId of loraIds) {
          filters.value.filterCriteria.push({ type: 'lora_id', value: loraId.trim() })
        }
      }

      // Load model filter from URL
      if (route.query.model) {
        filters.value.filterCriteria.push({ type: 'model', value: route.query.model })
      }
    }

    // Watch for signal to open requests panel
    if (shouldOpenRequestsPanel) {
      watch(shouldOpenRequestsPanel, (shouldOpen) => {
        if (shouldOpen) {
          uiStore.openPanel()
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
    imagePolling.watchQueueStatus(queueStatus)

    // Watch for route changes to update filters
    // Watch all filter-related query params and route path
    watch(
      () => JSON.stringify({
        path: route.path,
        albumSlug: props.albumSlug,
        q: route.query.q,
        lora: route.query.lora,
        model: route.query.model,
        request: route.query.request
      }),
      async (newVal, oldVal) => {
        // Ignore route changes when opening/closing/navigating the modal or mobile menu
        // This allows URL updates for bookmarking without triggering data reloads
        const newPath = route.path
        const oldParsed = oldVal ? JSON.parse(oldVal) : {}
        const oldPath = oldParsed.path || ''

        // Check if this is just a modal open/close/navigation
        const isNewPathModal = newPath.includes('/image/')
        const isOldPathModal = oldPath.includes('/image/')

        if (isNewPathModal || isOldPathModal) {
          // Modal-related route change - don't reload data
          return
        }

        // Check if this is mobile menu related
        if (newPath === '/menu') {
          // Opening mobile menu - don't reload data
          return
        }

        if (oldPath === '/menu') {
          // Closing mobile menu - only reload if going to a different view than where we started
          // menuRouteBeforeOpen contains where we were before opening the menu
          if (menuRouteBeforeOpen.value && menuRouteBeforeOpen.value.path === newPath) {
            // Returning to same view (closed menu without selecting) - don't reload
            return
          }
          // Otherwise, user selected something different - let it reload below
        }

        // Load filters based on new route
        loadFiltersFromUrl()

        // Scroll to top when switching views
        window.scrollTo(0, 0)

        // Check if viewing an album
        if (currentView.value === 'album' && props.albumSlug) {
          await loadCurrentAlbum()
          offset.value = 0
          hasMore.value = true
          await fetchAlbumImages()
        } else {
          albumStore.setCurrentAlbum(null)
          offset.value = 0
          hasMore.value = true
          await fetchImages()
        }
      }
    )

    const handleClickOutside = (event) => {
      if (menuContainer.value && !menuContainer.value.contains(event.target)) {
        uiStore.closeMenu()
      }
    }

    onMounted(async () => {
      // Handle direct navigation to /menu
      if (route.path === '/menu') {
        if (window.innerWidth >= 768) {
          // Desktop: redirect to home
          router.replace('/')
        } else {
          // Mobile: open menu (no previous route to restore)
          isMobileMenuOpen.value = true
        }
      }

      loadFiltersFromUrl()

      // Check if viewing an album
      if (currentView.value === 'album' && props.albumSlug) {
        await loadCurrentAlbum()
        await fetchAlbumImages()
      } else {
        await fetchImages()
      }

      loadImageFromUrl()

      // Start requests polling (fetches and polls every 2 seconds)
      requestsStore.startPolling()

      window.addEventListener('scroll', handleScroll)
      window.addEventListener('click', handleClickOutside)
      window.addEventListener('resize', updateIsMobile)
    })

    onUnmounted(() => {
      requestsStore.stopPolling()
      imagePolling.cleanup()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('resize', updateIsMobile)
    })

    return {
      images,
      loading,
      selectedImage,
      currentImageIndex,
      canNavigatePrev,
      canNavigateNext,
      galleryTitle,
      totalFilterCount,
      formatFilterChip,
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
      // Requests
      requests,
      queueStatus,
      requestStatusClass,
      deletableRequests,
      viewRequestImages,
      showDeleteModal,
      handleRetry,
      confirmDelete,
      deleteModalVisible,
      deleteAllModalVisible,
      showDeleteAllModal,
      closeDeleteModal,
      closeDeleteAllModal,
      confirmDeleteAll,
      requestToDelete,
      // Sidebar and albums
      sidebarRef,
      sidebarCollapsed,
      currentView,
      currentAlbum,
      sidebarActiveView,
      sidebarActiveAlbumSlug,
      isCreateAlbumModalOpen,
      isAddToAlbumModalOpen,
      handleSidebarNavigate,
      handleViewRequestImages,
      handleCreateAlbum,
      closeCreateAlbumModal,
      handleAlbumCreated,
      handleAddToAlbum,
      closeAddToAlbumModal,
      handleAddedToAlbum,
      // Mobile menu
      isMobile,
      isMobileMenuOpen,
      openMobileMenu,
      closeMobileMenu,
      handleHamburgerClick,
      // Menu and filters
      showMenu,
      menuContainer,
      toggleMenu,
      toggleHiddenImages,
      checkHiddenAuth,
      isHiddenAuthenticated,
      // Multi-select mode
      isMultiSelectMode,
      selectedImages,
      selectedCount,
      deletableSelectedImages,
      skippedFavoriteCount,
      toggleMultiSelectMode,
      toggleImageSelection,
      showBatchDeleteModal,
      batchDelete,
      batchFavorite,
      batchUnfavorite,
      batchHide,
      batchUnhide,
      batchRemoveFromAlbum
    }
  }
}
</script>

<style scoped>
.library-view {
  padding: 0;
  padding-bottom: 0;
  --sidebar-width: 320px;
  --action-bar-height: 70px;
  transition: padding-bottom 0.3s ease-in-out, padding-left 0.3s ease;
  padding-left: var(--sidebar-width);
}

.library-view.sidebar-collapsed {
  padding-left: 0;
}

.library-view.action-bar-open {
  padding-bottom: var(--action-bar-height);
}

/* On mobile, don't add padding for sidebar */
@media (max-width: 1024px) {
  .library-view {
    padding-left: 0;
  }
}

.header {
  position: sticky;
  top: 0;
  background: var(--color-bg-base);
  z-index: 50;
  transition: top 0.3s ease-out;
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

/* Hamburger button (mobile, or desktop when sidebar collapsed) */
.btn-hamburger {
  display: flex;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 1.25rem;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-hamburger:hover {
  background: var(--color-surface-hover);
}

/* Header status dot */
.header-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 4px;
}

.header-status-dot.complete {
  background: #00ff00;
}

.header-status-dot.active {
  background: var(--color-warning-hover);
  animation: pulse 2s infinite;
}

.header-status-dot.error {
  background: var(--color-danger-ios);
  animation: pulse 2s infinite;
}

/* Mobile menu slide transition */
@media (max-width: 767px) {
  .mobile-menu-enter-active,
  .mobile-menu-leave-active {
    transition: transform 0.3s ease-out !important;
  }

  .mobile-menu-enter-from,
  .mobile-menu-leave-to {
    transform: translateX(-100%) !important;
  }

  .mobile-menu-enter-to,
  .mobile-menu-leave-from {
    transform: translateX(0) !important;
  }
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.menu-container {
  position: relative;
}

.btn-menu {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: var(--color-surface);
  border: 1px solid #333;
  color: var(--color-text-tertiary);
  font-size: 0.95rem;
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
  min-width: 200px;
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

.menu-item i.active {
  color: var(--color-warning);
}

/* Mobile-only menu items hidden on desktop */
.show-mobile-only {
  display: none;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  width: 100%;
  background: var(--color-bg-base);
}

/* Tablet: scale from 4 to max 5 columns */
@media (min-width: 500px) {
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(max(calc(100% / 5 - 4px), 110px), 1fr));
  }
}

/* Desktop: scale up to max 7 columns */
@media (min-width: 1401px) {
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(calc(100% / 7 - 4px), 1fr));
  }
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
  transition: all 0.2s, transform 0.3s ease-out, left 0.3s ease;
}

/* Move settings FAB when sidebar is expanded */
.library-view:not(.sidebar-collapsed) .fab-settings {
  left: calc(var(--sidebar-width) + 2rem);
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

.btn-action.btn-album {
  color: var(--color-info);
}

/* Requests Panel Tab */
/* Status dot animation (used in header) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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

  /* Requests panel mobile adjustments */
  .panel-content {
    padding: 1rem;
  }

  .requests-grid {
    gap: 0.5rem;
  }

  .request-card-item {
    padding: 0.75rem;
  }

  /* Hide standalone buttons, show in menu */
  .hide-mobile {
    display: none !important;
  }

  .show-mobile-only {
    display: flex !important;
  }

  /* Smaller FABs on mobile */
  .fab {
    width: 42px;
    height: 42px;
    font-size: 1.5rem;
    bottom: 1rem;
  }

  .fab-new {
    right: 1rem;
  }

  .fab-settings {
    left: 1rem;
  }

  /* On mobile, don't move FAB when sidebar opens (sidebar overlays content) */
  .library-view:not(.sidebar-collapsed) .fab-settings {
    left: 1rem;
  }
}

</style>
