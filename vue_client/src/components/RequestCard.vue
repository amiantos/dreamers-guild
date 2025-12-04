<template>
  <div class="request-card" :class="{ compact: compact }">
    <!-- Delete button in top-right corner -->
    <button
      @click="$emit('delete', request.uuid)"
      class="delete-btn"
      title="Delete request"
    >
      <i class="fa-solid fa-xmark"></i>
    </button>

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
          <!-- Retry action for failed requests -->
          <span
            v-if="request.status === 'failed'"
            class="progress-action retry"
            @click="$emit('retry', request.uuid)"
          >Retry</span>
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
    compact: {
      type: Boolean,
      default: false
    }
  },
  emits: ['view-images', 'delete', 'retry'],
  setup(props) {
    const thumbnailUrl = ref(null)
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
            thumbnailUrl.value = imagesApi.getThumbnailUrl(response.data.data[0].uuid)
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

    return {
      thumbnailUrl,
      truncatedPrompt,
      statusMessage,
      imageCount,
      formattedKudos,
      showKudos,
      progressPercent,
      progressBarClass
    }
  }
}
</script>

<style scoped>
/* ==============================================
   BASE STYLES
   ============================================== */

.request-card {
  position: relative;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.card-main {
  display: flex;
  gap: 0.75rem;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* Delete button - top right corner */
.delete-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s;
  font-size: 0.9rem;
}

.delete-btn:hover {
  opacity: 1;
  color: var(--color-danger-tailwind);
}

/* Thumbnail */
.thumbnail-container {
  flex-shrink: 0;
}

.thumbnail {
  width: 70px;
  height: 70px;
  border-radius: 8px;
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
  font-size: 1.5rem;
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
  border-radius: 8px;
}

.thumbnail-overlay i {
  color: white;
  font-size: 1.25rem;
}

.thumbnail.clickable:hover .thumbnail-overlay {
  opacity: 1;
}

.spinner {
  width: 20px;
  height: 20px;
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
  font-size: 0.95rem;
  font-weight: 500;
  margin: 0;
  padding-right: 1.5rem; /* Space for delete button */
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  flex-wrap: wrap;
  align-items: center;
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
}

.progress-bar {
  flex: 1;
  height: 4px;
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

/* Retry action text */
.progress-action {
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;
  position: relative;
}

.progress-action:hover {
  opacity: 0.8;
}

.progress-action.retry {
  color: var(--color-danger-tailwind);
}

/* ==============================================
   DESKTOP (>768px)
   ============================================== */

@media (min-width: 769px) {
  .card-body {
    gap: 0.7rem;
  }

  .thumbnail {
    width: 80px;
    height: 80px;
  }

  .prompt {
    font-size: 1rem;
    line-height: 1.3rem;
    -webkit-line-clamp: 2;
    padding-bottom:0px;
    margin-bottom:-3px;
  }
}

/* ==============================================
   COMPACT MODE (for sidebar)
   ============================================== */

.request-card.compact .card-content {
  gap: 0.6rem;
}

.request-card.compact .card-main {
  gap: 0.6rem;
  align-items: center;
}

.request-card.compact .thumbnail {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  flex-shrink: 0;
}

.request-card.compact .thumbnail.placeholder.error i {
  font-size: 1.25rem;
}

.request-card.compact .thumbnail-overlay i {
  font-size: 1rem;
}

.request-card.compact .spinner {
  width: 16px;
  height: 16px;
}

.request-card.compact .prompt {
  font-size: 0.8rem;
  line-height: 1.05rem;
  -webkit-line-clamp: 3;
  padding-right: 0.5rem;
}

.request-card.compact .card-body {
  gap: 0.45rem;
  display: flex;
  flex-direction: column;
}

.request-card.compact .progress-container {
  order: -1;
}

.request-card.compact .meta {
  font-size: 0.7rem;
}

.request-card.compact .progress-bar {
  height: 3px;
}

.request-card.compact .delete-btn {
  width: 20px;
  height: 20px;
  font-size: 0.75rem;
}

.request-card.compact .progress-action {
  font-size: 0.65rem;
}
</style>
