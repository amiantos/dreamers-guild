<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <button class="btn-close" @click="$emit('close')">×</button>

      <button
        v-if="showNavigation"
        class="btn-nav btn-prev"
        @click="$emit('navigate', -1)"
        title="Previous image (←)"
      >
        ‹
      </button>

      <button
        v-if="showNavigation"
        class="btn-nav btn-next"
        @click="$emit('navigate', 1)"
        title="Next image (→)"
      >
        ›
      </button>

      <div class="image-container">
        <img :src="imageUrl" :alt="image.prompt_simple" />
      </div>

      <div class="image-details">
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
          <a :href="imageUrl" :download="`aislingeach-${image.uuid}.png`" class="btn btn-download">
            <i class="fa-solid fa-download"></i> Download
          </a>
          <button @click="$emit('delete', image.uuid)" class="btn btn-icon btn-delete" title="Delete image">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
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

    // Watch for prop changes when navigating between images
    watch(() => props.image, (newImage) => {
      isFavorite.value = !!newImage.is_favorite
      isHidden.value = !!newImage.is_hidden
    })

    const imageUrl = computed(() => {
      return imagesApi.getImageUrl(props.image.uuid)
    })

    const showNavigation = computed(() => {
      return props.images.length > 1
    })

    const hasSettings = computed(() => {
      return props.image.full_request && props.image.full_request.trim() !== ''
    })

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
      formatDate,
      isFavorite,
      isHidden,
      toggleFavorite,
      toggleHidden
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
}

.image-container img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
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
</style>
