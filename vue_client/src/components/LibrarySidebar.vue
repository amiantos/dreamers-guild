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

        <div v-if="userAlbums.length === 0" class="empty-albums">
          <p>No albums yet</p>
        </div>

        <div v-else class="albums-list">
          <div
            v-for="album in visibleUserAlbums"
            :key="album.id"
            class="album-item"
            :class="{ active: activeAlbumSlug === album.slug }"
            @click="navigate('album', album.slug)"
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
              <span class="album-title">{{ album.title }}</span>
              <span class="album-count">{{ album.count }}</span>
            </div>
            <i v-if="album.is_hidden" class="fa-solid fa-eye-slash hidden-badge"></i>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { albumsApi, imagesApi } from '@api'
import AsyncImage from './AsyncImage.vue'

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
  emits: ['navigate', 'toggle-collapse', 'create-album'],
  setup(props, { emit }) {
    const isCollapsed = ref(window.innerWidth < 1024)
    const isMobile = ref(window.innerWidth < 1024)
    const userAlbums = ref([])

    const visibleUserAlbums = computed(() => {
      if (props.isAuthenticated) {
        return userAlbums.value
      }
      return userAlbums.value.filter(album => !album.is_hidden)
    })

    const loadAlbums = async () => {
      try {
        const response = await albumsApi.getAll({ includeHidden: props.isAuthenticated })
        userAlbums.value = response.data || []
      } catch (error) {
        console.error('Error loading albums:', error)
      }
    }

    const getThumbnailUrl = (imageId) => {
      return imagesApi.getThumbnailUrl(imageId)
    }

    const toggleCollapse = () => {
      isCollapsed.value = !isCollapsed.value
      localStorage.setItem('sidebarCollapsed', isCollapsed.value)
      emit('toggle-collapse', isCollapsed.value)
    }

    const navigate = (view, albumSlug = null) => {
      emit('navigate', { view, albumSlug })
      if (isMobile.value) {
        isCollapsed.value = true
      }
    }

    const handleResize = () => {
      isMobile.value = window.innerWidth < 1024
      // Auto-collapse on mobile if not explicitly set
      if (isMobile.value && !localStorage.getItem('sidebarCollapsed')) {
        isCollapsed.value = true
      }
    }

    // Watch for authentication changes to reload albums
    watch(() => props.isAuthenticated, () => {
      loadAlbums()
    })

    onMounted(() => {
      // Restore collapsed state from localStorage
      const savedState = localStorage.getItem('sidebarCollapsed')
      if (savedState !== null) {
        isCollapsed.value = savedState === 'true'
      }

      window.addEventListener('resize', handleResize)
      loadAlbums()
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
    })

    return {
      isCollapsed,
      isMobile,
      userAlbums,
      visibleUserAlbums,
      getThumbnailUrl,
      toggleCollapse,
      navigate,
      loadAlbums
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
  border-right: 1px solid var(--color-border);
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
  border: 1px solid var(--color-border);
  border-left: none;
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

/* Mobile responsive */
@media (max-width: 1024px) {
  .sidebar-container {
    width: 300px;
  }

  .sidebar-container:not(.collapsed) {
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
  }
}
</style>
