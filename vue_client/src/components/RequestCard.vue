<template>
  <div class="request-card" :class="statusClass">
    <div class="request-header">
      <div class="request-info">
        <h3 class="prompt">{{ truncatedPrompt }}</h3>
        <div class="meta">
          <span class="date">{{ formattedDate }}</span>
          <span class="divider">•</span>
          <span class="count">{{ request.n }} {{ request.n === 1 ? 'image' : 'images' }}</span>
        </div>
      </div>
      <div class="request-status">
        <span class="status-badge" :class="statusClass">{{ statusText }}</span>
      </div>
    </div>

    <div v-if="showProgress" class="progress-info">
      <div v-if="request.queue_position > 0" class="queue-info">
        Queue position: {{ request.queue_position }}
        <span v-if="request.wait_time > 0">(~{{ formatWaitTime(request.wait_time) }})</span>
      </div>
      <div v-if="request.message" class="message">{{ request.message }}</div>
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
        class="btn btn-delete"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

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

    const statusClass = computed(() => {
      const status = props.request.status
      if (status === 'completed') return 'status-completed'
      if (status === 'failed') return 'status-failed'
      if (status === 'submitting' || status === 'processing' || status === 'downloading') return 'status-processing'
      return 'status-pending'
    })

    const statusText = computed(() => {
      const status = props.request.status
      if (status === 'pending') return 'Pending'
      if (status === 'submitting') return 'Submitting'
      if (status === 'processing') return 'Processing'
      if (status === 'downloading') return 'Downloading'
      if (status === 'completed') return 'Completed'
      if (status === 'failed') return 'Failed'
      return status
    })

    const showProgress = computed(() => {
      return ['pending', 'submitting', 'processing', 'downloading'].includes(props.request.status)
    })

    const formatWaitTime = (seconds) => {
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      return `${minutes}m`
    }

    return {
      truncatedPrompt,
      formattedDate,
      statusClass,
      statusText,
      showProgress,
      formatWaitTime
    }
  }
}
</script>

<style scoped>
.request-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.request-card:hover {
  border-color: #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
}

.divider {
  color: #555;
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
  background: #3a3a3a;
  color: #aaa;
}

.status-processing {
  background: #1a3a5a;
  color: #4a9eff;
}

.status-completed {
  background: #1a3a2a;
  color: #4aff88;
}

.status-failed {
  background: #3a1a1a;
  color: #ff4a4a;
}

.progress-info {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #0f0f0f;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #999;
}

.queue-info {
  margin-bottom: 0.5rem;
}

.message {
  color: #aaa;
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
