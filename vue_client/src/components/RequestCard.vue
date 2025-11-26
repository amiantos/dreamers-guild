<template>
  <div class="request-card">
    <div class="card-content">
      <div class="thumbnail-container">
        <div v-if="request.status === 'completed' && thumbnailUrl" class="thumbnail">
          <AsyncImage :src="thumbnailUrl" alt="Request thumbnail" />
        </div>
        <div v-else class="thumbnail placeholder">
          <div class="spinner"></div>
        </div>
      </div>

      <div class="card-body">
        <div class="request-header">
          <div class="request-info">
            <h3 class="prompt">{{ truncatedPrompt }}</h3>
            <div class="meta">
              <span class="date">{{ formattedDate }}</span>
              <span class="divider">•</span>
              <span class="count">{{ imageCount }} {{ imageCount === 1 ? 'image' : 'images' }}</span>
              <template v-if="statusMessage">
                <span class="divider">•</span>
                <span class="status-message">{{ statusMessage }}</span>
              </template>
            </div>
          </div>
          <div class="request-status">
            <span class="status-badge" :class="statusClass">{{ statusText }}</span>
          </div>
        </div>

        <div class="request-actions">
          <button
            v-if="request.status === 'completed'"
            @click="$emit('view-images', request.uuid)"
            class="btn btn-primary"
          >
            View Images
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
  emits: ['view-images', 'delete'],
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
      // For completed/failed requests, don't show additional message
      if (['completed', 'failed'].includes(props.request.status)) {
        return null
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

    return {
      thumbnailUrl,
      truncatedPrompt,
      formattedDate,
      statusClass,
      statusText,
      statusMessage,
      formatWaitTime,
      imageCount
    }
  }
}
</script>

<style scoped>
.request-card {

}

.request-card:hover {

}

.card-content {
  display: flex;
  gap: 1.5rem;
}

.thumbnail-container {
  flex-shrink: 0;
}

.thumbnail {
  width: 100px;
  height: 100px;
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

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.card-body {
  flex: 1;
  min-width: 0;
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.request-info {
  flex: 1;
  min-width: 0;
}

.prompt {
  font-size: 1.1rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: var(--color-text-primary);
}

.meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  flex-wrap: wrap;
}

.divider {
  color: var(--color-border-lighter);
}

.status-message {
  color: var(--color-text-secondary);
}

.request-status {
  flex-shrink: 0;
}

.status-badge {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
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

.request-actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon {
  padding: 0.6rem;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-text);
}

.btn-primary:hover {
  background: var(--color-btn-primary-hover);
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
</style>
