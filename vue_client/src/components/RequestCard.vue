<template>
  <div class="request-card">
    <div class="card-content">
      <!-- Desktop thumbnail (hidden on mobile via CSS) -->
      <div class="thumbnail-container">
        <div v-if="request.status === 'completed' && thumbnailUrl" class="thumbnail">
          <AsyncImage :src="thumbnailUrl" alt="Request thumbnail" />
        </div>
        <div v-else class="thumbnail placeholder">
          <div class="spinner"></div>
        </div>
      </div>

      <div class="card-body">
        <!-- Header: Prompt + Meta + Badge -->
        <div class="request-header">
          <div class="request-info">
            <h3 class="prompt">{{ truncatedPrompt }}</h3>
            <div class="meta">
              <span class="count">{{ imageCount }} {{ imageCount === 1 ? 'image' : 'images' }}</span>
              <template v-if="kudosCost > 0">
                <span class="divider">•</span>
                <span class="kudos">{{ formattedKudos }} kudos</span>
              </template>
            </div>
          </div>
        </div>

        <!-- Progress Row (for active states) -->
        <div v-if="showProgressBar" class="progress-row">
          <div class="progress-container">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="progressBarClass"
                :style="{ width: progressPercent + '%' }"
              ></div>
            </div>
            <span class="progress-text">{{ progressText }}</span>
          </div>
        </div>

        <!-- Status Message Row (for pending/failed) -->
        <div v-else-if="statusMessage" class="status-row">
          <span class="status-message" :class="{ 'status-message-error': request.status === 'failed' }">{{ statusMessage }}</span>
        </div>
      </div>
    </div>
    <!-- Bottom Row: Mobile thumbnail + Actions -->
        <div class="bottom-row">
          <div class="request-actions">
            <button
              v-if="request.status === 'completed'"
              @click="$emit('view-images', request.uuid)"
              class="btn btn-primary"
              title="View Images"
            >
              <i class="fa-solid fa-eye btn-icon-mobile"></i>
              <span class="btn-label">View Images</span>
            </button>
            <button
              v-if="request.status === 'failed'"
              @click="$emit('retry', request.uuid)"
              class="btn btn-secondary"
              title="Retry"
            >
              <i class="fa-solid fa-rotate-right"></i>
              <span class="btn-label">Retry</span>
            </button>
            <button
              @click="$emit('delete', request.uuid)"
              class="btn btn-icon btn-delete"
              title="Delete request"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue'
import { imagesApi } from '@api'
import { getStatusClass, getStatusText } from '../utils/statusUtils.js'
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
    }
  },
  emits: ['view-images', 'delete', 'retry'],
  setup(props) {
    const thumbnailUrl = ref(null)
    const actualImageCount = ref(null)

    const truncatedPrompt = computed(() => {
      const maxLength = 100
      if (props.request.prompt && props.request.prompt.length > maxLength) {
        return props.request.prompt.substring(0, maxLength) + '...'
      }
      return props.request.prompt || 'Untitled request'
    })

    const formattedDate = computed(() => {
      const date = new Date(props.request.date_created)
      return date.toLocaleString()
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

    const statusClass = computed(() => getStatusClass(props.request.status))

    const statusText = computed(() => getStatusText(props.request.status))

    const statusMessage = computed(() => {
      // For completed requests, don't show additional message
      if (props.request.status === 'completed') {
        return null
      }

      // For failed requests, show the error message
      if (props.request.status === 'failed') {
        return props.request.message || 'Request failed'
      }

      // Show queue position if available
      if (props.request.queue_position > 0) {
        const waitTime = props.request.wait_time > 0 ? ` (~${formatWaitTime(props.request.wait_time)})` : ''
        return `Queue position ${props.request.queue_position}${waitTime}`
      }

      // Otherwise show the message if available
      return props.request.message || null
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

    const showProgressBar = computed(() => {
      return ['submitting', 'processing', 'downloading'].includes(props.request.status)
    })

    const progressBarClass = computed(() => {
      if (props.request.status === 'submitting') return 'indeterminate'
      if (props.request.status === 'downloading') return 'downloading'
      return ''
    })

    const progressText = computed(() => {
      const finished = props.request.finished || 0
      const total = props.request.n || 0
      if (props.request.status === 'submitting') return 'Submitting...'
      if (props.request.status === 'downloading') return `Downloading ${finished}/${total}`
      return `${finished}/${total} completed`
    })

    return {
      thumbnailUrl,
      truncatedPrompt,
      formattedDate,
      statusClass,
      statusText,
      statusMessage,
      formatWaitTime,
      imageCount,
      kudosCost,
      formattedKudos,
      progressPercent,
      showProgressBar,
      progressBarClass,
      progressText
    }
  }
}
</script>

<style scoped>
/* ==============================================
   BASE STYLES (Mobile-first)
   ============================================== */

.card-content {
  display: flex;
  gap: 0.75rem;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Thumbnail */
.thumbnail-container {
  flex-shrink: 0;
}

.thumbnail {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-elevated);
}

.thumbnail-small {
  width: 60px;
  height: 60px;
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

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Header */
.request-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.request-info {
  flex: 1;
  min-width: 0;
}

.prompt {
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.25rem 0;
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
}

.divider {
  color: var(--color-border-lighter);
}

/* Status Badge */
.request-status {
  flex-shrink: 0;
}

.status-badge {
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.status-pending {
  background-color: var(--color-pending-bg);
  color: var(--color-text-secondary);
}

.status-processing {
  background-color: var(--color-info-bg);
  color: var(--color-info-tailwind);
}

.status-completed {
  background-color: var(--color-success-bg);
  color: var(--color-success-tailwind);
}

.status-failed {
  background-color: var(--color-danger-bg);
  color: var(--color-danger-tailwind);
}

/* Progress Bar */
.progress-row {
  margin-top: 0.25rem;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-info-tailwind);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.downloading {
  background: var(--color-success-tailwind);
}

.progress-fill.indeterminate {
  width: 30% !important;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.progress-text {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Status Message Row */
.status-row {
  margin-top: 0.25rem;
}

.status-message {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.status-message-error {
  color: var(--color-danger-tailwind);
}

/* Bottom Row (thumbnail + actions) */
.bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Actions */
.request-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-icon {
  width: 36px;
  height: 36px;
}

.btn-primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-text);
}

.btn-primary:hover {
  background: var(--color-btn-primary-hover);
}

.btn-secondary {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  gap: 0.5rem;
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-border-light);
}

.btn-delete {
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid var(--color-border);
}

.btn-delete:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-light);
}

/* ==============================================
   MOBILE: Icon-only buttons, show mobile thumbnail
   ============================================== */

/* Hide desktop thumbnail, show mobile thumbnail */
.desktop-only {
  display: none;
}

.mobile-only {
  display: block;
}

/* Hide button labels on mobile, show icons */
.btn-label {
  display: none;
}

.btn-icon-mobile {
  display: inline;
}

/* Make primary/secondary buttons icon-only on mobile */
.btn-primary,
.btn-secondary {
  width: 36px;
  height: 36px;
  padding: 0.5rem;
}

/* ==============================================
   DESKTOP (>768px): Horizontal layout
   ============================================== */

@media (min-width: 769px) {
  .card-content {
    flex-direction: row;
    gap: 1rem;
  }

  /* Show desktop thumbnail, hide mobile thumbnail */
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }

  /* Show button labels on desktop */
  .btn-label {
    display: inline;
  }

  .btn-icon-mobile {
    display: none;
  }

  /* Full buttons on desktop */
  .btn-primary,
  .btn-secondary {
    width: auto;
    height: auto;
    padding: 0.5rem 1rem;
  }

  .prompt {
    font-size: 1.05rem;
    -webkit-line-clamp: 1;
  }

  .status-badge {
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
  }

  .bottom-row {
    justify-content: flex-start;
  }

  .request-actions {
    justify-content: flex-start;
  }
}
</style>
