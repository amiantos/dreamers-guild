<template>
  <div class="library-view">
    <div class="header">
      <h2>{{ title }}</h2>
      <div v-if="keywords" class="search-info">
        Searching for: "{{ keywords }}"
        <button @click="clearSearch" class="btn-clear">Clear</button>
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
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { imagesApi } from '../api/client.js'
import ImageModal from '../components/ImageModal.vue'

export default {
  name: 'LibraryView',
  components: {
    ImageModal
  },
  props: {
    id: String, // request ID
    keywords: String,
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

    const title = computed(() => {
      if (props.id) return 'Request Images'
      if (props.keywords) return 'Search Results'
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

        if (props.id) {
          response = await imagesApi.getByRequestId(props.id, limit)
          hasMore.value = false // Request images don't paginate
        } else if (props.keywords) {
          response = await imagesApi.search(props.keywords, limit)
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
      // If we have context (request/search), go back to that view
      // Otherwise, if there's no history or we came directly to an image, go to library
      if (window.history.state?.back) {
        router.back()
      } else if (props.id) {
        router.push(`/library/request/${props.id}`)
      } else if (props.keywords) {
        router.push(`/library/search?q=${props.keywords}`)
      } else {
        router.push('/library')
      }
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
      router.replace(`/library/image/${imageId}`)
    }

    const deleteImage = async (imageId) => {
      if (!confirm('Delete this image?')) return

      try {
        await imagesApi.delete(imageId)
        images.value = images.value.filter(img => img.uuid !== imageId)
        selectedImage.value = null
        closeImage()
      } catch (error) {
        console.error('Error deleting image:', error)
      }
    }

    const clearSearch = () => {
      router.push('/library')
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

    onMounted(async () => {
      await fetchImages()
      loadImageFromUrl()
      window.addEventListener('scroll', handleScroll)
    })

    onUnmounted(() => {
      window.removeEventListener('scroll', handleScroll)
    })

    return {
      images,
      loading,
      selectedImage,
      currentImageIndex,
      gridContainer,
      title,
      getThumbnailUrl,
      formatDate,
      viewImage,
      closeImage,
      navigateImage,
      deleteImage,
      clearSearch
    }
  }
}
</script>

<style scoped>
.library-view {
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

.search-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  border-radius: 8px;
  color: #999;
}

.btn-clear {
  padding: 0.3rem 0.8rem;
  background: transparent;
  border: 1px solid #333;
  border-radius: 6px;
  color: #999;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-clear:hover {
  background: #2a2a2a;
  color: #fff;
}

.loading,
.loading-more {
  text-align: center;
  padding: 3rem;
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
