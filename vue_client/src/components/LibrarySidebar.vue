<template>
  <div class="sidebar-container" :class="{ collapsed: isCollapsed }">
    <!-- Collapse toggle button -->
    <button
      class="collapse-toggle"
      @click="toggleCollapse"
      :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
    >
      <i class="fa-solid" :class="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
    </button>

    <div class="sidebar-content" v-show="!isCollapsed">
      <!-- Navigation Section -->
      <nav class="nav-section">
        <div
          class="nav-item"
          :class="{ active: activeView === 'library' }"
          @click="navigate('library')"
        >
          <i class="fa-solid fa-images"></i>
          <span>Library</span>
        </div>

        <div
          class="nav-item"
          :class="{ active: activeView === 'favorites' }"
          @click="navigate('favorites')"
        >
          <i class="fa-solid fa-star"></i>
          <span>Favorites</span>
        </div>

        <div
          v-if="isAuthenticated"
          class="nav-item"
          :class="{ active: activeView === 'hidden' }"
          @click="navigate('hidden')"
        >
          <i class="fa-solid fa-eye-slash"></i>
          <span>Hidden</span>
        </div>

        <div
          v-if="isAuthenticated"
          class="nav-item"
          :class="{ active: activeView === 'hidden-favorites' }"
          @click="navigate('hidden-favorites')"
        >
          <i class="fa-solid fa-star"></i>
          <span>Hidden Favorites</span>
        </div>
      </nav>

      <!-- Albums Section -->
      <div class="section">
        <div class="section-header">
          <h3>Albums</h3>
          <button class="btn-add" @click="$emit('create-album')" title="Create Album">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>

        <div v-if="albums.length === 0" class="empty-albums">
          <p>No albums yet</p>
        </div>

        <div v-else class="albums-list">
          <div
            v-for="album in visibleUserAlbums"
            :key="album.id"
            class="album-item"
            :class="{ active: activeAlbumSlug === album.slug, editing: editingAlbumId === album.id }"
            @click="editingAlbumId !== album.id && navigate('album', album.slug)"
          >
            <div class="album-thumbnail">
              <AsyncImage
                v-if="album.thumbnail"
                :src="getThumbnailUrl(album.thumbnail)"
                :alt="album.title"
              />
              <i v-else class="fa-solid fa-folder"></i>
            </div>
            <div class="album-info">
              <!-- Inline edit mode -->
              <input
                v-if="editingAlbumId === album.id"
                type="text"
                v-model="editingTitle"
                @keyup.enter="saveAlbumTitle(album)"
                @keyup.escape="cancelEditing"
                @click.stop
                @blur="saveAlbumTitle(album)"
                class="album-title-input"
                ref="editInput"
              />
              <span v-else class="album-title">{{ album.title }}</span>
              <span class="album-count">{{ album.count }}</span>
            </div>
            <i v-if="album.is_hidden" class="fa-solid fa-eye-slash hidden-badge"></i>
            <!-- Action buttons on hover -->
            <div class="album-actions" v-if="editingAlbumId !== album.id" @click.stop>
              <button class="btn-action" @click="startEditing(album)" title="Rename">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-action btn-danger" @click="confirmDeleteAlbum(album)" title="Delete">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Delete confirmation modal -->
        <div v-if="albumToDelete" class="delete-confirm-overlay" @click="handleCancelDelete">
          <div class="delete-confirm-modal" @click.stop>
            <h4>Delete Album</h4>
            <p>Are you sure you want to delete "{{ albumToDelete.title }}"?</p>
            <p class="delete-warning">This album contains {{ albumToDelete.count }} image(s). Images will not be deleted.</p>
            <div class="delete-confirm-actions">
              <button class="btn-cancel" @click="handleCancelDelete">Cancel</button>
              <button class="btn-delete" @click="handleDeleteAlbum" :disabled="isDeleting">
                {{ isDeleting ? 'Deleting...' : 'Delete Album' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile overlay -->
  <div
    v-if="!isCollapsed && isMobile"
    class="sidebar-overlay"
    @click="toggleCollapse"
  ></div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { imagesApi } from '@api'
import AsyncImage from './AsyncImage.vue'
import { useToast } from '../composables/useToast.js'
import { useAlbumStore } from '../stores/albumStore.js'
import { useUiStore } from '../stores/uiStore.js'

export default {
  name: 'LibrarySidebar',
  components: {
    AsyncImage
  },
  props: {
    activeView: {
      type: String,
      default: 'library'
    },
    activeAlbumSlug: {
      type: String,
      default: null
    },
    isAuthenticated: {
      type: Boolean,
      default: false
    }
  },
  emits: ['navigate', 'create-album', 'album-deleted', 'album-renamed'],
  setup(props, { emit }) {
    const { showToast } = useToast()
    const albumStore = useAlbumStore()
    const uiStore = useUiStore()

    // Get reactive state from stores
    const {
      albums,
      editingAlbumId,
      editingTitle,
      albumToDelete,
      isDeleting
    } = storeToRefs(albumStore)

    const {
      sidebarCollapsed: isCollapsed,
      isMobile
    } = storeToRefs(uiStore)

    const editInput = ref(null)

    // Filter albums based on authentication state
    const visibleUserAlbums = computed(() => {
      if (props.isAuthenticated) {
        return albums.value
      }
      return albums.value.filter(album => !album.is_hidden)
    })

    const loadAlbums = async () => {
      try {
        await albumStore.loadAlbums(props.isAuthenticated)
      } catch (error) {
        showToast('Failed to load albums', 'error')
      }
    }

    const getThumbnailUrl = (imageId) => {
      return imagesApi.getThumbnailUrl(imageId)
    }

    const toggleCollapse = () => {
      uiStore.toggleSidebar()
    }

    const navigate = (view, albumSlug = null) => {
      emit('navigate', { view, albumSlug })
      if (isMobile.value) {
        uiStore.setSidebarCollapsed(true)
      }
    }

    // Album editing methods - wrap store actions for focus handling and toast
    const startEditing = (album) => {
      albumStore.startEditing(album)
      nextTick(() => {
        if (editInput.value) {
          const input = Array.isArray(editInput.value) ? editInput.value[0] : editInput.value
          if (input) {
            input.focus()
            input.select()
          }
        }
      })
    }

    const cancelEditing = () => {
      albumStore.cancelEditing()
    }

    const saveAlbumTitle = async (album) => {
      const oldSlug = album.slug
      try {
        const updated = await albumStore.saveAlbumTitle(album)
        if (updated) {
          // Emit event for parent to handle (e.g., redirect if viewing this album)
          emit('album-renamed', { oldSlug, newSlug: updated.slug, album: updated })
          showToast('Album renamed successfully', 'success')
        }
      } catch (error) {
        showToast('Failed to rename album', 'error')
      }
    }

    // Album deletion methods - wrap store actions for toast and emit
    const confirmDeleteAlbum = (album) => {
      albumStore.confirmDeleteAlbum(album)
    }

    const handleCancelDelete = () => {
      albumStore.cancelDelete()
    }

    const handleDeleteAlbum = async () => {
      const album = albumToDelete.value
      try {
        await albumStore.executeDelete()
        // Emit event for parent to handle navigation
        emit('album-deleted', album)
        showToast('Album deleted successfully', 'success')
      } catch (error) {
        showToast('Failed to delete album', 'error')
      }
    }

    // Watch for authentication changes to reload albums
    watch(() => props.isAuthenticated, () => {
      loadAlbums()
    })

    onMounted(() => {
      loadAlbums()
    })

    return {
      isCollapsed,
      isMobile,
      albums,
      visibleUserAlbums,
      getThumbnailUrl,
      toggleCollapse,
      navigate,
      loadAlbums,
      // Editing
      editingAlbumId,
      editingTitle,
      editInput,
      startEditing,
      cancelEditing,
      saveAlbumTitle,
      // Deleting
      albumToDelete,
      isDeleting,
      confirmDeleteAlbum,
      handleCancelDelete,
      handleDeleteAlbum
    }
  }
}
</script>

<style scoped>
.sidebar-container {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 280px;
  background: var(--color-bg-elevated);
  z-index: var(--z-index-panel);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.sidebar-container.collapsed {
  transform: translateX(-100%);
}

.collapse-toggle {
  position: absolute;
  right: -20px;
  /* top: 50%;
  transform: translateY(-50%); */
  width: 20px;
  height: 80px;
  background: var(--color-bg-elevated);
  border: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.collapse-toggle:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

/* Navigation Section */
.nav-section {
  padding: 0 0.5rem;
  margin-bottom: 1.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.nav-item:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-primary);
  color: var(--color-text-primary);
}

.nav-item i {
  width: 20px;
  text-align: center;
}

/* Section */
.section {
  padding: 0 0.5rem;
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem;
  margin-bottom: 0.5rem;
}

.section-header.collapsible {
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background 0.2s;
}

.section-header.collapsible:hover {
  background: var(--color-surface-hover);
}

.section-header h3 {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
}

.section-header i {
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
}

.btn-add {
  background: none;
  border: none;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: var(--color-text-tertiary);
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-add:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.empty-albums {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-disabled);
  font-size: 0.875rem;
}

/* Albums List */
.albums-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.album-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.album-item:hover {
  background: var(--color-surface-hover);
}

.album-item.active {
  background: var(--color-primary);
}

.album-item.active .album-title,
.album-item.active .album-count {
  color: var(--color-text-primary);
}

.album-thumbnail {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.album-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-thumbnail i {
  font-size: 1rem;
  color: var(--color-text-tertiary);
}

.album-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.album-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-count {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.hidden-badge {
  font-size: 0.75rem;
  color: var(--color-text-quaternary);
}

/* Mobile overlay */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-dark);
  z-index: calc(var(--z-index-panel) - 1);
}

/* Album actions (hover buttons) */
.album-actions {
  display: none;
  gap: 0.25rem;
  flex-shrink: 0;
}

.album-item:hover .album-actions {
  display: flex;
}

.album-item.editing .album-actions {
  display: none;
}

.btn-action {
  background: none;
  border: none;
  padding: 0.375rem;
  cursor: pointer;
  color: var(--color-text-tertiary);
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-action:hover {
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.btn-action.btn-danger:hover {
  color: var(--color-error);
}

/* Inline title editing */
.album-title-input {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
}

.album-title-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Delete confirmation modal */
.delete-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.delete-confirm-modal {
  background: var(--color-bg-elevated);
  border-radius: 12px;
  padding: 1.5rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.delete-confirm-modal h4 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: var(--color-text-primary);
}

.delete-confirm-modal p {
  margin: 0 0 0.75rem 0;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.delete-warning {
  color: var(--color-text-tertiary);
  font-size: 0.8125rem;
}

.delete-confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-cancel {
  padding: 0.625rem 1rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.btn-delete {
  padding: 0.625rem 1rem;
  border: none;
  background: var(--color-error);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-delete:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mobile responsive */
@media (max-width: 1024px) {
  .sidebar-container {
    width: 300px;
  }

  .sidebar-container:not(.collapsed) {
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
  }

  /* Always show actions on mobile since no hover */
  .album-actions {
    display: flex;
  }
}
</style>
