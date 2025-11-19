<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <button class="btn-close" @click="$emit('close')">×</button>

      <button
        v-if="showNavigation && !isProtected"
        class="btn-nav btn-prev"
        @click="$emit('navigate', -1)"
        title="Previous image (←)"
      >
        ‹
      </button>

      <button
        v-if="showNavigation && !isProtected"
        class="btn-nav btn-next"
        @click="$emit('navigate', 1)"
        title="Next image (→)"
      >
        ›
      </button>

      <div class="image-container" :class="{ 'protected': isProtected }">
        <img :src="imageUrl" :alt="image.prompt_simple" />
        <div v-if="isProtected" class="protection-overlay">
          <div class="protection-content">
            <i class="fa-solid fa-lock"></i>
            <h3>Hidden Image</h3>
            <p>This image is protected. Enter your PIN to view it.</p>
            <button @click="handleUnlock" class="btn btn-unlock">
              <i class="fa-solid fa-unlock"></i> Enter PIN
            </button>
          </div>
        </div>
      </div>

      <div v-if="!isProtected" class="image-details">
        <div v-if="image.prompt_simple" class="detail-row">
          <strong>Prompt:</strong>
          <p>{{ image.prompt_simple }}</p>
        </div>

        <div class="detail-row">
          <strong>Created:</strong>
          <p>{{ formatDate(image.date_created) }}</p>
        </div>

        <div v-if="image.backend" class="detail-row">
          <strong>Backend:</strong>
          <p>{{ image.backend }}</p>
        </div>

        <div class="actions">
          <button
            @click="toggleFavorite"
            :class="['btn', 'btn-icon', 'btn-favorite', { 'active': isFavorite }]"
            :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
          >
            <i class="fa-star" :class="isFavorite ? 'fa-solid' : 'fa-regular'"></i>
          </button>
          <button
            @click="toggleHidden"
            :class="['btn', 'btn-icon', 'btn-hidden', { 'active': isHidden }]"
            :title="isHidden ? 'Unhide image' : 'Hide image'"
          >
            <i :class="isHidden ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'"></i>
          </button>
          <button
            v-if="hasSettings"
            @click="$emit('load-settings', false)"
            class="btn btn-load-settings"
            title="Load generation settings from this image"
          >
            <i class="fa-solid fa-sliders"></i> Load Settings
          </button>
          <button
            v-if="hasSettings"
            @click="$emit('load-settings', true)"
            class="btn btn-load-settings-seed"
            title="Load generation settings including seed from this image"
          >
            <i class="fa-solid fa-sliders"></i> Load Settings + Seed
          </button>
          <button
            v-if="hasSettings"
            @click="showDetailsView('request')"
            class="btn btn-view-request"
            title="View full request JSON"
          >
            <i class="fa-solid fa-code"></i> View Request
          </button>
          <button
            v-if="hasResponse"
            @click="showDetailsView('response')"
            class="btn btn-view-response"
            title="View full response JSON"
          >
            <i class="fa-solid fa-file-code"></i> View Response
          </button>
          <a :href="imageUrl" :download="`aislingeach-${image.uuid}.png`" class="btn btn-download">
            <i class="fa-solid fa-download"></i> Download
          </a>
          <button @click="$emit('delete', image.uuid)" class="btn btn-icon btn-delete" title="Delete image">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <!-- Details Overlay -->
      <div v-if="showDetails" class="request-details-overlay">
        <div class="request-details-header">
          <h3>{{ detailsTitle }}</h3>
          <div class="header-actions">
            <button class="btn-copy" @click="copyToClipboard" :title="copyButtonText">
              <i :class="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'"></i>
              {{ copyButtonText }}
            </button>
            <button class="btn-close-details" @click="closeDetails">×</button>
          </div>
        </div>
        <div class="request-details-body">
          <pre>{{ currentDetailsContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onUnmounted, inject } from 'vue'
import { imagesApi } from '../api/client.js'

export default {
  name: 'ImageModal',
  props: {
    image: {
      type: Object,
      required: true
    },
    images: {
      type: Array,
      default: () => []
    },
    currentIndex: {
      type: Number,
      default: -1
    }
  },
  emits: ['close', 'delete', 'navigate', 'load-settings', 'update'],
  setup(props, { emit }) {
    const isFavorite = ref(!!props.image.is_favorite)
    const isHidden = ref(!!props.image.is_hidden)
    const checkHiddenAuth = inject('checkHiddenAuth')
    const requestHiddenAccess = inject('requestHiddenAccess')
    const showDetails = ref(false)
    const detailsType = ref('request')
    const copied = ref(false)

    // Watch for prop changes when navigating between images
    watch(() => props.image, (newImage) => {
      isFavorite.value = !!newImage.is_favorite
      isHidden.value = !!newImage.is_hidden
    })

    const imageUrl = computed(() => {
      return imagesApi.getImageUrl(props.image.uuid)
    })

    // Check if current image is in the images array (not a direct URL load)
    const isImageInArray = computed(() => {
      return props.images.some(img => img.uuid === props.image.uuid)
    })

    const showNavigation = computed(() => {
      // Only show navigation if there are multiple images AND the current image is in the array
      return props.images.length > 1 && isImageInArray.value
    })

    const hasSettings = computed(() => {
      return props.image.full_request && props.image.full_request.trim() !== ''
    })

    const hasResponse = computed(() => {
      return props.image.full_response && props.image.full_response.trim() !== ''
    })

    const formattedRequest = computed(() => {
      if (!props.image.full_request) return ''
      try {
        return JSON.stringify(JSON.parse(props.image.full_request), null, 2)
      } catch (e) {
        return props.image.full_request
      }
    })

    const formattedResponse = computed(() => {
      if (!props.image.full_response) return ''
      try {
        return JSON.stringify(JSON.parse(props.image.full_response), null, 2)
      } catch (e) {
        return props.image.full_response
      }
    })

    const detailsTitle = computed(() => {
      return detailsType.value === 'request' ? 'Request Details' : 'Response Details'
    })

    const currentDetailsContent = computed(() => {
      return detailsType.value === 'request' ? formattedRequest.value : formattedResponse.value
    })

    const copyButtonText = computed(() => {
      return copied.value ? 'Copied!' : 'Copy'
    })

    const showDetailsView = (type) => {
      detailsType.value = type
      showDetails.value = true
      copied.value = false
    }

    const closeDetails = () => {
      showDetails.value = false
      copied.value = false
    }

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(currentDetailsContent.value)
        copied.value = true
        setTimeout(() => {
          copied.value = false
        }, 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        alert('Failed to copy to clipboard')
      }
    }

    const formatDate = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleString()
    }

    const toggleFavorite = async () => {
      try {
        const newValue = !isFavorite.value
        await imagesApi.update(props.image.uuid, { isFavorite: newValue })
        isFavorite.value = newValue
        props.image.is_favorite = newValue ? 1 : 0
        emit('update', { uuid: props.image.uuid, is_favorite: newValue ? 1 : 0 })
      } catch (error) {
        console.error('Error toggling favorite:', error)
        alert('Failed to update favorite status')
      }
    }

    const toggleHidden = async () => {
      try {
        const newValue = !isHidden.value
        await imagesApi.update(props.image.uuid, { isHidden: newValue })
        isHidden.value = newValue
        props.image.is_hidden = newValue ? 1 : 0
        emit('update', { uuid: props.image.uuid, is_hidden: newValue ? 1 : 0 })
      } catch (error) {
        console.error('Error toggling hidden:', error)
        alert('Failed to update hidden status')
      }
    }

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        emit('close')
      } else if (e.key === 'ArrowLeft') {
        if (showNavigation.value) {
          emit('navigate', -1)
        }
      } else if (e.key === 'ArrowRight') {
        if (showNavigation.value) {
          emit('navigate', 1)
        }
      }
    }

    // Check if image should be protected (hidden and not authenticated)
    const isProtected = computed(() => {
      return props.image.is_hidden && checkHiddenAuth && !checkHiddenAuth()
    })

    const handleUnlock = () => {
      if (requestHiddenAccess) {
        requestHiddenAccess(() => {
          // Image will automatically become visible once authenticated
        })
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })

    return {
      imageUrl,
      showNavigation,
      hasSettings,
      hasResponse,
      formatDate,
      isFavorite,
      isHidden,
      toggleFavorite,
      toggleHidden,
      isProtected,
      handleUnlock,
      showDetails,
      detailsType,
      detailsTitle,
      currentDetailsContent,
      showDetailsView,
      closeDetails,
      copyToClipboard,
      copied,
      copyButtonText
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  position: relative;
  max-width: 1200px;
  width: 100%;
  max-height: 90vh;
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.btn-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 2rem;
  line-height: 1;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.95);
}

.btn-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  border: none;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 3rem;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.btn-nav:hover {
  background: rgba(0, 0, 0, 0.95);
  transform: translateY(-50%) scale(1.1);
}

.btn-prev {
  left: 1rem;
}

.btn-next {
  right: 1rem;
}

.image-container {
  flex: 1;
  display: flex;
  justify-content: center;
  background: #000;
  overflow: hidden;
  min-height: 0;
  position: relative;
}

.image-container.protected img {
  filter: blur(50px);
}

.image-container img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.protection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.protection-content {
  text-align: center;
  color: #fff;
  padding: 2rem;
  max-width: 400px;
}

.protection-content i.fa-lock {
  font-size: 4rem;
  color: #007bff;
  margin-bottom: 1.5rem;
}

.protection-content h3 {
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
  font-weight: 600;
}

.protection-content p {
  margin: 0 0 2rem 0;
  color: #999;
  font-size: 1.1rem;
  line-height: 1.5;
}

.btn-unlock {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-unlock:hover {
  background: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.btn-unlock i {
  font-size: 1rem;
}

.image-details {
  padding: 1.5rem;
  background: #1a1a1a;
  border-top: 1px solid #333;
}

.detail-row {
  margin-bottom: 1rem;
}

.detail-row:last-of-type {
  margin-bottom: 1.5rem;
}

.detail-row strong {
  display: block;
  color: #999;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.detail-row p {
  color: #fff;
  margin: 0;
  word-break: break-word;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-icon {
  padding: 0.6rem;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-load-settings {
  background: #34C759;
  color: white;
}

.btn-load-settings:hover {
  background: #248A3D;
}

.btn-load-settings-seed {
  background: #30D158;
  color: white;
}

.btn-load-settings-seed:hover {
  background: #1F8B3C;
}

.btn-download {
  background: #007AFF;
  color: white;
}

.btn-download:hover {
  background: #0051D5;
}

.btn-delete {
  background: transparent;
  color: #ff4a4a;
  border: 1px solid #3a1a1a;
}

.btn-delete:hover {
  background: #3a1a1a;
  border-color: #ff4a4a;
}

.btn-favorite {
  background: transparent;
  color: #FFD60A;
  border: 1px solid #3a3a1a;
}

.btn-favorite:hover {
  background: #3a3a1a;
  border-color: #FFD60A;
}

.btn-favorite.active {
  background: #FFD60A;
  color: #000;
  border-color: #FFD60A;
}

.btn-hidden {
  background: transparent;
  color: #999;
  border: 1px solid #2a2a2a;
}

.btn-hidden:hover {
  background: #2a2a2a;
  border-color: #999;
}

.btn-hidden.active {
  background: #666;
  color: #fff;
  border-color: #666;
}

.btn-view-request {
  background: #5856D6;
  color: white;
}

.btn-view-request:hover {
  background: #4745AC;
}

.btn-view-response {
  background: #AF52DE;
  color: white;
}

.btn-view-response:hover {
  background: #8E44AD;
}

.request-details-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  z-index: 20;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
}

.request-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.request-details-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-copy {
  background: #007AFF;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-copy:hover {
  background: #0051D5;
}

.btn-copy i.fa-check {
  color: #34C759;
}

.btn-close-details {
  background: none;
  border: none;
  color: #999;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.btn-close-details:hover {
  color: #fff;
}

.request-details-body {
  flex: 1;
  overflow: auto;
  background: #111;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #333;
}

.request-details-body pre {
  margin: 0;
  color: #0f0;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
