<template>
  <div class="keywords-panel" :class="{ open: isOpen }">
    <div class="panel-header">
      <h3>Frequent Keywords</h3>
      <button class="btn-close" @click="$emit('close')" title="Close">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>

    <div class="panel-content">
      <div v-if="keywords.length === 0" class="empty-state">
        <p>No keywords</p>
      </div>

      <div v-else class="keywords-list">
        <!-- Keywords -->
        <div
          v-for="keyword in keywords"
          :key="keyword.id"
          class="keyword-card"
          @click="$emit('select', keyword)"
        >
          <div class="keyword-thumbnail">
            <img
              v-if="keyword.thumbnail"
              :src="getThumbnailUrl(keyword.thumbnail)"
              :alt="keyword.name"
            />
            <div v-else class="keyword-icon">
              <i class="fa-solid fa-hashtag"></i>
            </div>
          </div>
          <div class="keyword-info">
            <div class="keyword-name">{{ keyword.name }}</div>
            <div class="keyword-count">{{ keyword.count }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { imagesApi } from '../api/client.js'

export default {
  name: 'KeywordsPanel',
  props: {
    keywords: {
      type: Array,
      required: true
    },
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'select'],
  setup(props) {
    const getThumbnailUrl = (imageId) => {
      return imagesApi.getThumbnailUrl(imageId)
    }

    return {
      getThumbnailUrl
    }
  }
}
</script>

<style scoped>
.keywords-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 300px;
  background: #171717;
  border-right: 1px solid #333;
  z-index: 100;
  transform: translateX(-100%);
  transition: transform 0.3s ease-out;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.keywords-panel.open {
  transform: translateX(0);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1rem;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 1.2rem;
  cursor: pointer;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  color: #fff;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: #666;
}

.keywords-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.keyword-card {
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.keyword-card:hover {
  background: #1a1a1a;
  border-color: #444;
  transform: translateX(4px);
}

.keyword-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  background: #1a1a1a;
  flex-shrink: 0;
}

.keyword-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.keyword-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.keyword-icon i.fa-hashtag {
  color: #00D4FF;
}

.keyword-info {
  flex: 1;
  min-width: 0;
}

.keyword-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: #fff;
  margin-bottom: 0.25rem;
}

.keyword-count {
  font-size: 0.85rem;
  color: #999;
}
</style>
