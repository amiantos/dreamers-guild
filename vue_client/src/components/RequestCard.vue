<template>
  <div class="request-card" :class="statusClass">
    <div class="card-content">
      <div class="thumbnail-container">
        <div v-if="request.status === 'completed' && thumbnailUrl" class="thumbnail">
          <img :src="thumbnailUrl" alt="Request thumbnail" />
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
              <span class="count">{{ request.n }} {{ request.n === 1 ? 'image' : 'images' }}</span>
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
import { imagesApi } from '../api/client.js'
import { getStatusClass, getStatusText } from '../utils/statusUtils.js'

export default {
  name: 'RequestCard',
  props: {
    request: {
      type: Object,
      required: true
    }
  },
  emits: ['view-images', 'delete'],
  setup(props) {
    const thumbnailUrl = ref(null)

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
          if (response.data && response.data.length > 0) {
            thumbnailUrl.value = imagesApi.getThumbnailUrl(response.data[0].uuid)
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

    return {
      thumbnailUrl,
      truncatedPrompt,
      formattedDate,
      statusClass,
      statusText,
      statusMessage,
      formatWaitTime
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
  background: #0f0f0f;
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
  background: #0f0f0f;
  border: 1px solid #333;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #333;
  border-top-color: #007AFF;
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
  color: #fff;
}

.meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #999;
  flex-wrap: wrap;
}

.divider {
  color: #555;
}

.status-message {
  color: #aaa;
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
  background-color: rgba(128, 128, 128, 0.2);
  color: #aaa;
}

.status-processing {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.status-completed {
  background-color: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.status-failed {
  background-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
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
  background: #007AFF;
  color: white;
}

.btn-primary:hover {
  background: #0051D5;
}

.btn-delete {
  background: transparent;
  color: #999;
  border: 1px solid #333;
}

.btn-delete:hover {
  background: #2a2a2a;
  color: #fff;
  border-color: #444;
}
</style>
