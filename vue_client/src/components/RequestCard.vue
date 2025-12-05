<template>
  <div class="request-card">
    <!-- Action buttons in bottom-right corner -->
    <div class="action-buttons">
      <button
        v-if="request.status === 'completed' || request.status === 'failed'"
        @click="handleRetryRepeat"
        class="action-btn retry-btn"
        :title="request.status === 'failed' ? 'Retry request' : 'Repeat request'"
      >
        <i class="fa-solid fa-arrow-rotate-right"></i>
      </button>
      <button
        @click="$emit('delete', request.uuid)"
        class="action-btn delete-btn"
        title="Delete request"
      >
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>

    <div class="card-content">
      <div class="card-main">
        <div class="thumbnail-container">
          <!-- Completed with thumbnail -->
          <div
            v-if="request.status === 'completed' && thumbnailUrl"
            class="thumbnail clickable"
            @click="$emit('view-images', request.uuid)"
          >
            <AsyncImage :src="thumbnailUrl" alt="Request thumbnail" />
            <div class="thumbnail-overlay">
              <i class="fa-solid fa-eye"></i>
            </div>
          </div>
          <!-- Completed but thumbnail is hidden -->
          <div
            v-else-if="request.status === 'completed' && thumbnailHidden"
            class="thumbnail placeholder clickable hidden"
            @click="$emit('view-images', request.uuid)"
          >
            <i class="fa-solid fa-eye-slash"></i>
          </div>
          <!-- Failed state - show alert icon -->
          <div v-else-if="request.status === 'failed'" class="thumbnail placeholder error">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <!-- Completed but no images -->
          <div v-else-if="request.status === 'completed'" class="thumbnail placeholder">
          </div>
          <!-- Processing states - show spinner -->
          <div v-else class="thumbnail placeholder">
            <div class="spinner"></div>
          </div>
        </div>

        <h3 class="prompt">{{ truncatedPrompt }}</h3>
      </div>

      <div class="card-body">
        <div class="meta">
          <!-- Show image count only when completed, otherwise show status -->
          <template v-if="request.status === 'completed'">
            <span class="count">{{ imageCount }} {{ imageCount === 1 ? 'image' : 'images' }}</span>
          </template>
          <template v-else-if="statusMessage">
            <span class="status-message" :class="{ 'status-message-error': request.status === 'failed' }">{{ statusMessage }}</span>
          </template>

          <template v-if="showKudos">
            <span class="divider">•</span>
            <span class="kudos">{{ formattedKudos }} kudos</span>
          </template>
        </div>
        <div class="progress-container">
          <div class="progress-bar" :class="{ 'progress-bar-failed': request.status === 'failed' }">
            <div
              class="progress-fill"
              :class="progressBarClass"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue'
import { imagesApi } from '@api'
import AsyncImage from './AsyncImage.vue'

export default {
  name: 'RequestCard',
  components: {
    AsyncImage
  },
  props: {
    request: {
      type: Object,
      required: true
    },
    showHiddenThumbnails: {
      type: Boolean,
      default: false
    }
  },
  emits: ['view-images', 'delete', 'retry', 'repeat'],
  setup(props, { emit }) {
    const thumbnailUrl = ref(null)
    const thumbnailHidden = ref(false)
    const actualImageCount = ref(null)

    const truncatedPrompt = computed(() => {
      const maxLength = 300
      if (props.request.prompt && props.request.prompt.length > maxLength) {
        return props.request.prompt.substring(0, maxLength) + '...'
      }
      return props.request.prompt || 'Untitled request'
    })

    // Fetch first image thumbnail for completed requests
    const fetchThumbnail = async () => {
      if (props.request.status === 'completed') {
        try {
          const response = await imagesApi.getByRequestId(props.request.uuid, 1)
          // Backend returns { data: images, total }
          if (response.data && response.data.data && response.data.data.length > 0) {
            const firstImage = response.data.data[0]
            // Check if the thumbnail image is hidden (show anyway if in hidden mode)
            if (firstImage.is_hidden && !props.showHiddenThumbnails) {
              thumbnailHidden.value = true
              thumbnailUrl.value = null
            } else {
              thumbnailHidden.value = false
              thumbnailUrl.value = imagesApi.getThumbnailUrl(firstImage.uuid)
            }
            actualImageCount.value = response.data.total
          }
        } catch (error) {
          console.error('Error fetching thumbnail:', error)
        }
      }
    }

    // Watch for status changes to completed
    watch(
      () => props.request.status,
      (newStatus) => {
        if (newStatus === 'completed' && !thumbnailUrl.value) {
          fetchThumbnail()
        }
      }
    )

    // Watch for authentication changes to show/hide thumbnails
    watch(
      () => props.showHiddenThumbnails,
      () => {
        // Re-fetch to update hidden state based on new auth status
        if (props.request.status === 'completed') {
          fetchThumbnail()
        }
      }
    )

    onMounted(() => {
      fetchThumbnail()
    })

    const statusMessage = computed(() => {
      const finished = props.request.finished || 0
      const total = props.request.n || 0

      // For completed requests, don't show additional message
      if (props.request.status === 'completed') {
        return null
      }

      // For failed requests, show the error message
      if (props.request.status === 'failed') {
        return props.request.message || 'Request failed'
      }

      // For submitting status or no status yet
      if (props.request.status === 'submitting' || !props.request.status) {
        return 'Submitting to AI Horde...'
      }

      // For downloading status
      if (props.request.status === 'downloading') {
        return `Downloading ${finished}/${total}`
      }

      // Show queue position if available
      if (props.request.queue_position > 0) {
        const waitTime = props.request.wait_time > 0 ? ` (~${formatWaitTime(props.request.wait_time)})` : ''
        return `Queue position ${props.request.queue_position}${waitTime}`
      }

      // For processing status without queue position
      if (props.request.status === 'processing') {
        return `Processing ${finished}/${total}`
      }

      // Default fallback
      return props.request.message || 'Submitting to AI Horde...'
    })

    // Hide kudos when still queued or submitting
    const showKudos = computed(() => {
      if (!props.request.status || props.request.status === 'submitting') {
        return false
      }
      if (props.request.queue_position > 0) {
        return false
      }
      return kudosCost.value > 0
    })

    const formatWaitTime = (seconds) => {
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      return `${minutes}m`
    }

    const imageCount = computed(() => {
      // Use actual count from backend if available, otherwise fall back to requested count
      return actualImageCount.value !== null ? actualImageCount.value : props.request.n
    })

    // Kudos cost display
    const kudosCost = computed(() => {
      return props.request.total_kudos_cost || 0
    })

    const formattedKudos = computed(() => {
      const cost = kudosCost.value
      if (cost >= 1000) {
        return (cost / 1000).toFixed(1) + 'k'
      }
      return cost.toString()
    })

    // Progress tracking for active requests
    const progressPercent = computed(() => {
      if (!props.request.n || props.request.n === 0) return 0
      const finished = props.request.finished || 0
      return Math.round((finished / props.request.n) * 100)
    })

    const progressBarClass = computed(() => {
      if (props.request.status === 'submitting') return 'indeterminate'
      if (props.request.status === 'completed') return 'completed'
      if (props.request.status === 'failed') return 'failed'
      // Keep sliding animation until images start completing
      const finished = props.request.finished || 0
      if (finished === 0) return 'indeterminate'
      return ''
    })

    const handleRetryRepeat = () => {
      if (props.request.status === 'failed') {
        emit('retry', props.request.uuid)
      } else if (props.request.status === 'completed') {
        emit('repeat', props.request.uuid)
      }
    }

    return {
      thumbnailUrl,
      thumbnailHidden,
      truncatedPrompt,
      statusMessage,
      imageCount,
      formattedKudos,
      showKudos,
      progressPercent,
      progressBarClass,
      handleRetryRepeat
    }
  }
}
</script>

<style scoped>
.request-card {
  position: relative;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.card-main {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

/* Action buttons - bottom right corner */
.action-buttons {
  position: absolute;
  bottom: 5px;
  right: 5px;
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background 0.2s, color 0.2s;
  font-size: 0.75rem;
}

/* Thumbnail */
.thumbnail-container {
  flex-shrink: 0;
}

.thumbnail {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg-elevated);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.thumbnail.placeholder.error {
  border-color: rgba(239, 68, 68, 0.3);
}

.thumbnail.placeholder.error i {
  color: var(--color-danger-tailwind);
  font-size: 1.25rem;
}

.thumbnail.placeholder.hidden i {
  color: var(--color-text-tertiary);
  font-size: 1.25rem;
}

.thumbnail.clickable {
  cursor: pointer;
  position: relative;
}

.thumbnail-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 6px;
}

.thumbnail-overlay i {
  color: white;
  font-size: 1rem;
}

.thumbnail.clickable:hover .thumbnail-overlay {
  opacity: 1;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.prompt {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  line-height: 1.05rem;
  font-weight: 500;
  margin: 0;
  padding-right: 0.5rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  flex-wrap: wrap;
  align-items: center;
  padding-right: 2rem;
}

.divider {
  color: var(--color-border-lighter);
}

/* Status message inline */
.status-message {
  color: var(--color-text-secondary);
}

.status-message-error {
  color: var(--color-danger-tailwind);
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  order: -1;
}

.progress-bar {
  flex: 1;
  height: 3px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-failed {
  background: rgba(239, 68, 68, 0.3);
}

.progress-fill {
  height: 100%;
  background: var(--color-warning);
  border-radius: 2px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.progress-fill.completed {
  background: var(--color-primary);
}

.progress-fill.failed {
  background: var(--color-danger-tailwind);
  width: 100% !important;
}

.progress-fill.indeterminate {
  width: 30% !important;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
</style>
