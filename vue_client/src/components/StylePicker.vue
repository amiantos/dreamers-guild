<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Styles</h3>
          <button class="btn-menu" @click="showMenu = !showMenu" title="Preview Options">
            ⋯
          </button>
          <button class="btn-close" @click="$emit('close')" title="Close">
            ×
          </button>
        </div>

        <!-- Preview Options Menu -->
        <div v-if="showMenu" class="options-menu">
          <div class="menu-section">
            <h4>Preview Subject</h4>
            <label class="menu-option">
              <input type="radio" value="person" v-model="previewOptions.subject" />
              <span>👤 Person</span>
            </label>
            <label class="menu-option">
              <input type="radio" value="place" v-model="previewOptions.subject" />
              <span>🏛 Place</span>
            </label>
            <label class="menu-option">
              <input type="radio" value="thing" v-model="previewOptions.subject" />
              <span>🚗 Thing</span>
            </label>
          </div>

          <div class="menu-section">
            <h4>Preview Size</h4>
            <label class="menu-option">
              <input type="radio" value="regular" v-model="previewOptions.size" />
              <span>🖼 Regular</span>
            </label>
            <label class="menu-option">
              <input type="radio" value="large" v-model="previewOptions.size" />
              <span>🖼 Large</span>
            </label>
          </div>

          <div class="menu-section">
            <h4>Preview Type</h4>
            <label class="menu-option">
              <input type="radio" value="fill" v-model="previewOptions.type" />
              <span>▣ Fill</span>
            </label>
            <label class="menu-option">
              <input type="radio" value="fit" v-model="previewOptions.type" />
              <span>▢ Fit</span>
            </label>
          </div>
        </div>

        <div class="search-container">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search styles..."
            class="search-input"
          />
        </div>

        <div class="style-grid-container">
          <div v-if="loadingStyles" class="loading">Loading styles...</div>

          <div v-else-if="error" class="error">
            {{ error }}
          </div>

          <div v-else>
            <!-- Favorites Section -->
            <div v-if="favoriteStyles.length > 0" class="section">
              <h4 class="section-title">Favorites</h4>
              <div class="style-grid" :class="`grid-${previewOptions.size}`">
                <div
                  v-for="style in favoriteStyles"
                  :key="style.name"
                  class="style-card"
                  :class="{ selected: selectedStyle === style.name }"
                  @click="selectStyle(style)"
                >
                  <div
                    class="style-preview"
                    :class="`preview-${previewOptions.type}`"
                    :style="getPreviewStyle(style)"
                  >
                    <button
                      class="btn-favorite active"
                      @click="toggleFavorite(style.name, $event)"
                      title="Remove from favorites"
                    >
                      <i class="fa-solid fa-star"></i>
                    </button>
                    <div v-if="!getPreviewUrl(style)" class="no-preview">
                      <span class="no-preview-text">{{ style.name }}</span>
                    </div>
                  </div>
                  <div class="style-name">{{ style.name }}</div>
                </div>
              </div>
            </div>

            <!-- All Styles Section -->
            <div class="section">
              <h4 class="section-title">All Styles</h4>
              <div class="style-grid" :class="`grid-${previewOptions.size}`">
                <div
                  v-for="style in nonFavoriteStyles"
                  :key="style.name"
                  class="style-card"
                  :class="{ selected: selectedStyle === style.name }"
                  @click="selectStyle(style)"
                >
                  <div
                    class="style-preview"
                    :class="`preview-${previewOptions.type}`"
                    :style="getPreviewStyle(style)"
                  >
                    <button
                      class="btn-favorite"
                      @click="toggleFavorite(style.name, $event)"
                      title="Add to favorites"
                    >
                      <i class="fa-regular fa-star"></i>
                    </button>
                    <div v-if="!getPreviewUrl(style)" class="no-preview">
                      <span class="no-preview-text">{{ style.name }}</span>
                    </div>
                  </div>
                  <div class="style-name">{{ style.name }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { stylesApi, settingsApi } from '@api'

export default {
  name: 'StylePicker',
  props: {
    currentStyle: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'select'],
  setup(props, { emit }) {
    const styles = ref([])
    const loadingStyles = ref(true)
    const error = ref(null)
    const selectedStyle = ref(props.currentStyle)
    const searchQuery = ref('')
    const showMenu = ref(false)
    const favorites = ref([])

    const previewOptions = reactive({
      subject: 'place',
      size: 'regular',
      type: 'fill'
    })

    const filteredStyles = computed(() => {
      if (!searchQuery.value) {
        return styles.value
      }
      const query = searchQuery.value.toLowerCase()
      return styles.value.filter(style =>
        style.name.toLowerCase().includes(query) ||
        (style.prompt && style.prompt.toLowerCase().includes(query)) ||
        (style.model && style.model.toLowerCase().includes(query))
      )
    })

    const favoriteStyles = computed(() => {
      return filteredStyles.value.filter(style =>
        favorites.value.includes(style.name)
      )
    })

    const nonFavoriteStyles = computed(() => {
      return filteredStyles.value.filter(style =>
        !favorites.value.includes(style.name)
      )
    })

    const getPreviewUrl = (style) => {
      if (!style.preview || !style.preview[previewOptions.subject]) {
        return null
      }
      return style.preview[previewOptions.subject]
    }

    const getPreviewStyle = (style) => {
      const url = getPreviewUrl(style)
      if (!url) return {}

      return {
        backgroundImage: `url(${url})`,
        backgroundSize: previewOptions.type === 'fill' ? 'cover' : 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    }

    const loadPreviewPreferences = async () => {
      try {
        const response = await settingsApi.get()
        if (response && response.default_params) {
          try {
            const params = JSON.parse(response.default_params)
            if (params.stylePreviewOptions) {
              Object.assign(previewOptions, params.stylePreviewOptions)
            }
          } catch (e) {
            console.error('Error parsing preview preferences:', e)
          }
        }
      } catch (error) {
        console.error('Error loading preview preferences:', error)
      }
    }

    const savePreviewPreferences = async () => {
      try {
        const response = await settingsApi.get()
        const currentParams = response.default_params
          ? JSON.parse(response.default_params)
          : {}

        currentParams.stylePreviewOptions = { ...previewOptions }

        await settingsApi.update({
          defaultParams: currentParams
        })
      } catch (error) {
        console.error('Error saving preview preferences:', error)
      }
    }

    const loadFavorites = async () => {
      try {
        const response = await settingsApi.get()
        if (response && response.favorite_styles) {
          try {
            const parsed = JSON.parse(response.favorite_styles)
            favorites.value = Array.isArray(parsed) ? parsed : []
          } catch (parseError) {
            console.error('Error parsing favorite_styles:', parseError)
            favorites.value = []
          }
        } else {
          favorites.value = []
        }
      } catch (error) {
        console.error('Error loading favorites:', error)
        favorites.value = []
      }
    }

    const saveFavorites = async () => {
      try {
        await settingsApi.update({ favoriteStyles: favorites.value })
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }

    const toggleFavorite = (styleName, event) => {
      // Stop event propagation so clicking the star doesn't select the style
      if (event) {
        event.stopPropagation()
      }

      const index = favorites.value.indexOf(styleName)
      if (index > -1) {
        favorites.value.splice(index, 1)
      } else {
        favorites.value.push(styleName)
      }
      saveFavorites()
    }

    const fetchStyles = async () => {
      try {
        loadingStyles.value = true
        error.value = null
        const response = await stylesApi.getAll()
        styles.value = response.data.allStyles || []
      } catch (err) {
        console.error('Error fetching styles:', err)
        error.value = 'Failed to load styles. Please try again.'
      } finally {
        loadingStyles.value = false
      }
    }

    const selectStyle = (style) => {
      selectedStyle.value = style.name
      emit('select', style)
      emit('close')
    }

    // Watch for preview option changes and save them
    watch(previewOptions, () => {
      savePreviewPreferences()
    })

    onMounted(async () => {
      await loadFavorites()
      await loadPreviewPreferences()
      await fetchStyles()
    })

    return {
      styles,
      loadingStyles,
      error,
      selectedStyle,
      searchQuery,
      showMenu,
      previewOptions,
      filteredStyles,
      favoriteStyles,
      nonFavoriteStyles,
      favorites,
      toggleFavorite,
      selectStyle,
      getPreviewUrl,
      getPreviewStyle
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-container {
  width: 90%;
  max-width: 1000px;
  height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-content {
  background: var(--color-surface);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  gap: 1rem;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  flex: 1;
}

.btn-menu {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 1.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s;
  line-height: 1;
}

.btn-menu:hover {
  color: var(--color-text-primary);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--color-text-primary);
}

.options-menu {
  background: var(--color-bg-elevated);
  border-bottom: 1px solid #333;
  padding: 1rem 1.5rem;
  flex-shrink: 0;
}

.menu-section {
  margin-bottom: 1rem;
}

.menu-section:last-child {
  margin-bottom: 0;
}

.menu-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.menu-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.menu-option:hover {
  background: var(--color-surface);
}

.menu-option input[type="radio"] {
  width: auto;
  cursor: pointer;
}

.menu-option span {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.search-container {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-bg-elevated);
  border: 1px solid #333;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.style-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.loading,
.error {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-tertiary);
}

.error {
  color: var(--color-danger-ios);
}

.style-grid {
  display: grid;
  gap: 1rem;
}

.style-grid.grid-regular {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.style-grid.grid-large {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.style-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-elevated);
  border: 2px solid #333;
  transition: all 0.2s;
}

.style-card:hover {
  border-color: var(--color-border-light);
  transform: translateY(-2px);
}

.style-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px #587297;
}

.style-preview {
  aspect-ratio: 1;
  width: 100%;
  position: relative;
}

.style-preview.preview-fill {
  background-size: cover !important;
}

.style-preview.preview-fit {
  background-size: contain !important;
  background-color: var(--color-bg-quaternary);
}

.no-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
}

.no-preview-text {
  color: var(--color-text-disabled);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
  padding: 1rem;
}

.style-name {
  padding: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  text-align: center;
  background: var(--color-bg-elevated);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section {
  margin-bottom: 1.5rem;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.5rem;
}

.btn-favorite {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--overlay-medium-dark);
  backdrop-filter: blur(4px);
  border: none;
  color: var(--color-text-disabled);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  line-height: 1;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 2;
}

.btn-favorite:hover {
  background: var(--overlay-darker);
  color: var(--color-warning-gold);
  transform: scale(1.1);
}

.btn-favorite.active {
  color: var(--color-warning-gold);
  background: var(--overlay-dark);
}

.btn-favorite.active:hover {
  background: var(--overlay-darkest);
}
</style>
