<template>
  <BaseModal
    :show="isOpen"
    @close="$emit('close')"
    size="small"
    :closeOnBackdrop="true"
  >
    <div class="add-to-album-modal">
      <div class="modal-header">
        <h2>Add to Album</h2>
        <p class="image-count">{{ imageIds.length }} {{ imageIds.length === 1 ? 'image' : 'images' }} selected</p>
      </div>

      <div class="modal-body">
        <!-- Quick Create -->
        <div class="quick-create">
          <div class="quick-create-header" @click="toggleQuickCreate">
            <i class="fa-solid fa-plus"></i>
            <span>Create New Album</span>
            <i class="fa-solid" :class="showQuickCreate ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </div>

          <div v-if="showQuickCreate" class="quick-create-form">
            <input
              type="text"
              v-model="newAlbumName"
              placeholder="Album name"
              ref="quickCreateInput"
              @keyup.enter="createAndAdd"
            />
            <label class="checkbox-label">
              <input type="checkbox" v-model="newAlbumHidden" />
              <span>Hidden</span>
            </label>
            <button
              class="btn-quick-create"
              @click="createAndAdd"
              :disabled="!newAlbumName.trim() || isCreating"
            >
              {{ isCreating ? 'Creating...' : 'Create & Add' }}
            </button>
          </div>
        </div>

        <!-- Albums List -->
        <div class="albums-section">
          <div v-if="loading" class="loading-state">
            Loading albums...
          </div>

          <div v-else-if="albums.length === 0" class="empty-state">
            <p>No albums yet</p>
            <p class="hint">Create your first album above</p>
          </div>

          <div v-else class="albums-list">
            <div
              v-for="album in albums"
              :key="album.id"
              class="album-item"
              :class="{ selected: selectedAlbumId === album.id }"
              @click="selectAlbum(album.id)"
            >
              <div class="album-info">
                <span class="album-title">{{ album.title }}</span>
                <span class="album-count">{{ album.count }} images</span>
              </div>
              <i v-if="album.is_hidden" class="fa-solid fa-eye-slash hidden-badge"></i>
              <div class="radio-indicator">
                <div v-if="selectedAlbumId === album.id" class="radio-dot"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="$emit('close')">
          Cancel
        </button>
        <button
          type="button"
          class="btn-add"
          @click="addToSelectedAlbum"
          :disabled="!selectedAlbumId || isAdding"
        >
          {{ isAdding ? 'Adding...' : 'Add to Album' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import { albumsApi } from '@api'
import BaseModal from './BaseModal.vue'

export default {
  name: 'AddToAlbumModal',
  components: {
    BaseModal
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    imageIds: {
      type: Array,
      required: true
    },
    includeHidden: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'added'],
  setup(props, { emit }) {
    const albums = ref([])
    const loading = ref(true)
    const selectedAlbumId = ref(null)
    const isAdding = ref(false)
    const isCreating = ref(false)

    // Quick create state
    const showQuickCreate = ref(false)
    const newAlbumName = ref('')
    const newAlbumHidden = ref(false)
    const quickCreateInput = ref(null)

    const loadAlbums = async () => {
      loading.value = true
      try {
        const response = await albumsApi.getAll({ includeHidden: props.includeHidden })
        albums.value = response.data || []
      } catch (error) {
        console.error('Error loading albums:', error)
      } finally {
        loading.value = false
      }
    }

    const toggleQuickCreate = () => {
      showQuickCreate.value = !showQuickCreate.value
      if (showQuickCreate.value) {
        nextTick(() => {
          if (quickCreateInput.value) {
            quickCreateInput.value.focus()
          }
        })
      }
    }

    const selectAlbum = (albumId) => {
      selectedAlbumId.value = albumId
    }

    const createAndAdd = async () => {
      if (!newAlbumName.value.trim() || isCreating.value) return

      isCreating.value = true

      try {
        // Create the album
        const createResponse = await albumsApi.create({
          title: newAlbumName.value.trim(),
          isHidden: newAlbumHidden.value
        })

        const newAlbum = createResponse.data

        // Add images to the new album
        await albumsApi.addImages(newAlbum.id, props.imageIds)

        emit('added', { albumId: newAlbum.id, count: props.imageIds.length })
        emit('close')

        // Reset form
        newAlbumName.value = ''
        newAlbumHidden.value = false
        showQuickCreate.value = false
      } catch (error) {
        console.error('Error creating album and adding images:', error)
        alert('Failed to create album. Please try again.')
      } finally {
        isCreating.value = false
      }
    }

    const addToSelectedAlbum = async () => {
      if (!selectedAlbumId.value || isAdding.value) return

      isAdding.value = true

      try {
        await albumsApi.addImages(selectedAlbumId.value, props.imageIds)

        emit('added', { albumId: selectedAlbumId.value, count: props.imageIds.length })
        emit('close')
      } catch (error) {
        console.error('Error adding images to album:', error)
        alert('Failed to add images to album. Please try again.')
      } finally {
        isAdding.value = false
      }
    }

    // Load albums when modal opens
    watch(() => props.isOpen, (isOpen) => {
      if (isOpen) {
        loadAlbums()
        selectedAlbumId.value = null
      }
    })

    onMounted(() => {
      if (props.isOpen) {
        loadAlbums()
      }
    })

    return {
      albums,
      loading,
      selectedAlbumId,
      isAdding,
      isCreating,
      showQuickCreate,
      newAlbumName,
      newAlbumHidden,
      quickCreateInput,
      toggleQuickCreate,
      selectAlbum,
      createAndAdd,
      addToSelectedAlbum
    }
  }
}
</script>

<style scoped>
.add-to-album-modal {
  padding: 1.5rem;
}

.modal-header {
  margin-bottom: 1.25rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.image-count {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Quick Create */
.quick-create {
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
}

.quick-create-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-create-header:hover {
  background: var(--color-surface-hover);
}

.quick-create-header i:first-child {
  color: var(--color-primary);
}

.quick-create-header span {
  flex: 1;
  font-weight: 500;
  color: var(--color-text-primary);
}

.quick-create-header i:last-child {
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
}

.quick-create-form {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quick-create-form input[type="text"] {
  padding: 0.625rem 0.875rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 0.9375rem;
}

.quick-create-form input[type="text"]:focus {
  outline: none;
  border-color: var(--color-primary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.btn-quick-create {
  padding: 0.625rem 1rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-quick-create:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-quick-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Albums Section */
.albums-section {
  max-height: 300px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-disabled);
}

.empty-state .hint {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.albums-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.album-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.album-item:hover {
  background: var(--color-surface-hover);
}

.album-item.selected {
  background: var(--color-primary);
}

.album-item.selected .album-title,
.album-item.selected .album-count {
  color: var(--color-text-primary);
}

.album-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.album-title {
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-count {
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
}

.hidden-badge {
  font-size: 0.75rem;
  color: var(--color-text-quaternary);
}

.album-item.selected .hidden-badge {
  color: rgba(255, 255, 255, 0.7);
}

.radio-indicator {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.album-item.selected .radio-indicator {
  border-color: var(--color-text-primary);
}

.radio-dot {
  width: 8px;
  height: 8px;
  background: var(--color-text-primary);
  border-radius: 50%;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-cancel,
.btn-add {
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-cancel:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.btn-add {
  background: var(--color-primary);
  border: none;
  color: var(--color-text-primary);
}

.btn-add:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
