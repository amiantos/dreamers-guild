<template>
  <BaseModal
    :show="isOpen"
    @close="$emit('close')"
    size="xlarge"
    :closeOnBackdrop="true"
  >
    <div class="albums-modal">
      <div class="modal-header">
        <h2>Albums</h2>
      </div>

      <div class="modal-body">
        <div v-if="keywords.length === 0" class="empty-state">
          <p>No albums yet</p>
          <p class="hint">Albums are automatically created based on frequently used keywords</p>
        </div>

        <div v-else class="albums-grid">
          <div
            v-for="keyword in keywords"
            :key="keyword.id"
            class="album-card"
            @click="selectAlbum(keyword)"
          >
            <div class="album-cover">
              <AsyncImage
                v-if="keyword.thumbnail"
                :src="getThumbnailUrl(keyword.thumbnail)"
                :alt="keyword.name"
              />
              <div v-else class="album-icon">
                <i class="fa-solid fa-hashtag"></i>
              </div>
            </div>
            <div class="album-info">
              <div class="album-name">{{ keyword.name }}</div>
              <div class="album-count">{{ keyword.count }} {{ keyword.count === 1 ? 'image' : 'images' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script>
import { computed } from 'vue'
import { imagesApi } from '@api'
import BaseModal from './BaseModal.vue'
import AsyncImage from './AsyncImage.vue'

export default {
  name: 'AlbumsModal',
  components: {
    BaseModal,
    AsyncImage
  },
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
  setup(props, { emit }) {
    const getThumbnailUrl = (imageId) => {
      return imagesApi.getThumbnailUrl(imageId)
    }

    const selectAlbum = (keyword) => {
      emit('select', keyword)
      emit('close')
    }

    return {
      getThumbnailUrl,
      selectAlbum
    }
  }
}
</script>

<style scoped>
.albums-modal {
  padding: 2rem;
}

.modal-header {
  margin-bottom: 2rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.modal-body {
  min-height: 300px;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--color-text-disabled);
}

.empty-state p {
  margin-bottom: 0.5rem;
}

.empty-state .hint {
  font-size: 0.9rem;
  color: var(--color-border-lighter);
}

.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.album-card {
  background: var(--color-bg-elevated);
  border: 1px solid #333;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.album-card:hover {
  background: var(--color-surface);
  border-color: var(--color-border-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.album-cover {
  width: 100%;
  aspect-ratio: 1;
  background: var(--color-surface);
  overflow: hidden;
  position: relative;
}

.album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.album-icon i.fa-hashtag {
  color: #00D4FF;
}

.album-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.album-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-count {
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .albums-modal {
    padding: 1.5rem;
  }

  .albums-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }

  .modal-header h2 {
    font-size: 1.5rem;
  }
}
</style>
