<template>
  <div class="library-view">
    <div class="header">
      <h2>{{ title }}</h2>

      <div class="header-controls">
        <!-- Active Filters -->
        <div v-if="filters.requestId || filters.keywords" class="filter-chips">
          <div v-if="filters.requestId" class="filter-chip">
            <span>Request</span>
            <button @click="clearFilter('requestId')" class="chip-remove">×</button>
          </div>
          <div v-if="filters.keywords" class="filter-chip">
            <span>{{ filters.keywords }}</span>
            <button @click="clearFilter('keywords')" class="chip-remove">×</button>
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

    <div v-if="loading && images.length === 0" class="loading">
      Loading images...
    </div>

    <div v-else-if="images.length === 0" class="empty-state">
      <p>No images yet</p>
      <p class="hint">Generate some images to see them here</p>
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
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { imagesApi } from '../api/client.js'
import ImageModal from '../components/ImageModal.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal
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
      keywords: null
    })

    // Inject the loadSettingsFromImage function from App.vue
    const loadSettingsFromImage = inject('loadSettingsFromImage')

    // Load filters from localStorage
    const loadFilters = () => {
      try {
        const saved = localStorage.getItem('libraryFilters')
        if (saved) {
          const parsed = JSON.parse(saved)
          filters.value = { ...filters.value, ...parsed }
        }
      } catch (error) {
        console.error('Error loading filters:', error)
      }
    }

    // Save filters to localStorage
    const saveFilters = () => {
      localStorage.setItem('libraryFilters', JSON.stringify(filters.value))
    }

    const title = computed(() => {
      return 'All Images'
    })

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
          response = await imagesApi.search(filters.value.keywords, limit)
          hasMore.value = false // Search doesn't paginate yet
        } else {
          response = await imagesApi.getAll(limit, offset.value)
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
      router.replace('/library')
    }

    const setFilter = (filterType, value) => {
      filters.value[filterType] = value
      saveFilters()
      offset.value = 0
      hasMore.value = true
      fetchImages()
    }

    const clearFilter = (filterType) => {
      filters.value[filterType] = null
      saveFilters()
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
      searchQuery.value = ''
      saveFilters()
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
        router.push(`/library/image/${imageId}`)
      } else {
        router.replace(`/library/image/${imageId}`)
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

    // Listen for filter changes from localStorage (e.g., from other tabs or RequestCard)
    const handleStorageChange = (e) => {
      if (e.key === 'libraryFilters') {
        loadFilters()
        offset.value = 0
        hasMore.value = true
        fetchImages()
      }
    }

    onMounted(async () => {
      loadFilters()
      await fetchImages()
      loadImageFromUrl()
      window.addEventListener('scroll', handleScroll)
      window.addEventListener('storage', handleStorageChange)
    })

    onUnmounted(() => {
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
      title,
      filters,
      searchQuery,
      getThumbnailUrl,
      formatDate,
      viewImage,
      closeImage,
      navigateImage,
      deleteImage,
      handleLoadSettings,
      applySearch,
      clearFilter,
      clearAllFilters
    }
  }
}
</script>

<style scoped>
.library-view {
  padding: 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  margin-bottom: 0;
  position: sticky;
  top: 60px; /* Height of the navbar */
  background: #0a0a0a;
  z-index: 50;
  border-bottom: 1px solid #333;
  gap: 2rem;
}

.header h2 {
  font-size: 2rem;
  font-weight: 600;
  white-space: nowrap;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
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
  margin-left: auto;
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
</style>
