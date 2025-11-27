<template>
  <div class="inline-style-picker">
    <!-- Header row: Search + Preview Options -->
    <div class="picker-header">
      <div class="search-container">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search styles..."
          class="search-input"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="btn-clear-search"
          @click="searchQuery = ''"
          title="Clear search"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="preview-options">
        <!-- Subject selector -->
        <div class="option-group">
          <button
            type="button"
            :class="{ active: previewOptions.subject === 'person' }"
            @click="previewOptions.subject = 'person'"
            title="Person"
          >
            <i class="fa-solid fa-user"></i>
          </button>
          <button
            type="button"
            :class="{ active: previewOptions.subject === 'place' }"
            @click="previewOptions.subject = 'place'"
            title="Place"
          >
            <i class="fa-solid fa-mountain-sun"></i>
          </button>
          <button
            type="button"
            :class="{ active: previewOptions.subject === 'thing' }"
            @click="previewOptions.subject = 'thing'"
            title="Thing"
          >
            <i class="fa-solid fa-cube"></i>
          </button>
        </div>

        <!-- Size toggle -->
        <div class="option-group">
          <button
            type="button"
            :class="{ active: previewOptions.size === 'regular' }"
            @click="previewOptions.size = 'regular'"
            title="Regular size"
          >
            <i class="fa-solid fa-grip"></i>
          </button>
          <button
            type="button"
            :class="{ active: previewOptions.size === 'large' }"
            @click="previewOptions.size = 'large'"
            title="Large size"
          >
            <i class="fa-solid fa-square"></i>
          </button>
        </div>

        <!-- Type toggle -->
        <div class="option-group">
          <button
            type="button"
            :class="{ active: previewOptions.type === 'fill' }"
            @click="previewOptions.type = 'fill'"
            title="Fill"
          >
            <i class="fa-solid fa-expand"></i>
          </button>
          <button
            type="button"
            :class="{ active: previewOptions.type === 'fit' }"
            @click="previewOptions.type = 'fit'"
            title="Fit"
          >
            <i class="fa-solid fa-compress"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable style grid -->
    <div class="style-grid-container">
      <div v-if="loadingStyles" class="loading">Loading styles...</div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <div v-else>
        <!-- Selected Style Section -->
        <div v-if="selectedStyleData" class="section selected-section">
          <h4 class="section-title">Selected</h4>
          <div class="style-grid" :class="`grid-${previewOptions.size}`">
            <div
              class="style-card selected"
              @click="selectStyle(selectedStyleData)"
            >
              <div
                class="style-preview"
                :class="`preview-${previewOptions.type}`"
                :style="getPreviewStyle(selectedStyleData)"
              >
                <button
                  type="button"
                  class="btn-favorite"
                  :class="{ active: favorites.includes(selectedStyleData.name) }"
                  @click="toggleFavorite(selectedStyleData.name, $event)"
                  :title="favorites.includes(selectedStyleData.name) ? 'Remove from favorites' : 'Add to favorites'"
                >
                  <i :class="favorites.includes(selectedStyleData.name) ? 'fa-solid fa-star' : 'fa-regular fa-star'"></i>
                </button>
                <div v-if="!getPreviewUrl(selectedStyleData)" class="no-preview">
                  <span class="no-preview-text">{{ selectedStyleData.name }}</span>
                </div>
              </div>
              <div class="style-name">{{ selectedStyleData.name }}</div>
            </div>
          </div>
        </div>

        <!-- Category Sections (includes Favorites, new, featured, etc.) -->
        <div
          v-for="category in displayCategories"
          :key="category.name"
          class="section"
        >
          <h4 class="section-title">{{ category.name }}</h4>
          <div class="style-grid" :class="`grid-${previewOptions.size}`">
            <div
              v-for="style in category.styles"
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
                  type="button"
                  class="btn-favorite"
                  :class="{ active: favorites.includes(style.name) }"
                  @click="toggleFavorite(style.name, $event)"
                  :title="favorites.includes(style.name) ? 'Remove from favorites' : 'Add to favorites'"
                >
                  <i :class="favorites.includes(style.name) ? 'fa-solid fa-star' : 'fa-regular fa-star'"></i>
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
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { stylesApi, settingsApi } from '@api'

// Module-level cache for styles (persists across component mounts)
const stylesCache = {
  data: null,
  timestamp: 0,
  TTL: 5 * 60 * 1000 // 5 minutes
}

export default {
  name: 'InlineStylePicker',
  props: {
    currentStyle: {
      type: String,
      default: ''
    }
  },
  emits: ['select', 'stylesLoaded'],
  setup(props, { emit }) {
    const styles = ref([])
    const serverCategories = ref([]) // Categories from server (includes Favorites)
    const loadingStyles = ref(true)
    const error = ref(null)
    const selectedStyle = ref(props.currentStyle)
    const searchQuery = ref('')
    const favorites = ref([]) // Local favorites for instant UI updates

    const previewOptions = reactive({
      subject: 'place',
      size: 'regular',
      type: 'fill'
    })

    // Watch for external changes to currentStyle prop
    watch(() => props.currentStyle, (newValue) => {
      selectedStyle.value = newValue
    })

    // Check if a style matches the search query
    const styleMatchesSearch = (style, query) => {
      if (!query) return true
      const q = query.toLowerCase()
      // Match style name
      if (style.name.toLowerCase().includes(q)) return true
      // Match prompt
      if (style.prompt && style.prompt.toLowerCase().includes(q)) return true
      // Match model
      if (style.model && style.model.toLowerCase().includes(q)) return true
      return false
    }

    // Check if a category name matches the search query
    const categoryMatchesSearch = (categoryName, query) => {
      if (!query) return false
      return categoryName.toLowerCase().includes(query.toLowerCase())
    }

    // Build display categories with local favorites and search filtering
    const displayCategories = computed(() => {
      const query = searchQuery.value
      const result = []
      const shownStyles = new Set()

      // First, build Favorites section from local favorites array
      if (favorites.value.length > 0) {
        const favoriteStyles = styles.value.filter(s =>
          favorites.value.includes(s.name) &&
          styleMatchesSearch(s, query)
        )
        if (favoriteStyles.length > 0) {
          favoriteStyles.forEach(s => shownStyles.add(s.name.toLowerCase()))
          result.push({
            name: 'Favorites',
            styles: favoriteStyles
          })
        }
      }

      // Then add other categories from server (skip server's Favorites section)
      for (const category of serverCategories.value) {
        if (category.name === 'Favorites') continue

        // If category name matches search, include all styles from it
        const categoryMatches = categoryMatchesSearch(category.name, query)

        const filteredStyles = category.styles.filter(style => {
          // Skip if already shown in favorites
          if (shownStyles.has(style.name.toLowerCase())) return false
          // Include if category matches OR style matches search
          return categoryMatches || styleMatchesSearch(style, query)
        })

        if (filteredStyles.length > 0) {
          filteredStyles.forEach(s => shownStyles.add(s.name.toLowerCase()))
          result.push({
            name: category.name,
            styles: filteredStyles
          })
        }
      }

      return result
    })

    // Get the full style object for the selected style
    const selectedStyleData = computed(() => {
      if (!selectedStyle.value) return null
      return styles.value.find(s => s.name === selectedStyle.value)
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

    const saveFavorites = async () => {
      try {
        await settingsApi.update({ favoriteStyles: favorites.value })
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }

    const toggleFavorite = (styleName, event) => {
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
      const now = Date.now()

      // Check if we have valid cached data
      if (stylesCache.data && (now - stylesCache.timestamp) < stylesCache.TTL) {
        console.log('[Styles] Using cached styles')
        styles.value = stylesCache.data.allStyles || []
        serverCategories.value = stylesCache.data.categorizedStyles || []

        // Extract favorites from cached response
        const favoritesCategory = serverCategories.value.find(c => c.name === 'Favorites')
        if (favoritesCategory) {
          favorites.value = favoritesCategory.styles.map(s => s.name)
        }

        loadingStyles.value = false
        emit('stylesLoaded', styles.value)
        return
      }

      try {
        loadingStyles.value = true
        error.value = null
        const response = await stylesApi.getAll()

        // Cache the response
        stylesCache.data = response.data
        stylesCache.timestamp = now

        styles.value = response.data.allStyles || []
        serverCategories.value = response.data.categorizedStyles || []

        // Extract favorites from server response (from the Favorites category)
        const favoritesCategory = serverCategories.value.find(c => c.name === 'Favorites')
        if (favoritesCategory) {
          favorites.value = favoritesCategory.styles.map(s => s.name)
        }

        // Emit styles loaded event with all styles
        emit('stylesLoaded', styles.value)
      } catch (err) {
        console.error('Error fetching styles:', err)
        error.value = 'Failed to load styles. Please try again.'
      } finally {
        loadingStyles.value = false
      }
    }

    const selectStyle = (style) => {
      // In Simple mode, just switch to the new style (no toggle off)
      if (selectedStyle.value !== style.name) {
        selectedStyle.value = style.name
        emit('select', style)
      }
    }

    // Expose method to get a style by name
    const getStyleByName = (name) => {
      return styles.value.find(s => s.name === name)
    }

    // Watch for preview option changes and save them
    watch(previewOptions, () => {
      savePreviewPreferences()
    })

    // Watch for search query changes and save to localStorage
    watch(searchQuery, (newValue) => {
      if (newValue) {
        localStorage.setItem('styleSearchQuery', newValue)
      } else {
        localStorage.removeItem('styleSearchQuery')
      }
    })

    onMounted(async () => {
      // Restore search query from localStorage
      const savedSearch = localStorage.getItem('styleSearchQuery')
      if (savedSearch) {
        searchQuery.value = savedSearch
      }

      await loadPreviewPreferences()
      await fetchStyles()
    })

    return {
      styles,
      loadingStyles,
      error,
      selectedStyle,
      selectedStyleData,
      searchQuery,
      previewOptions,
      displayCategories,
      favorites,
      toggleFavorite,
      selectStyle,
      getPreviewUrl,
      getPreviewStyle,
      getStyleByName
    }
  }
}
</script>

<style scoped>
.inline-style-picker {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.picker-header {
  flex-shrink: 0;
  display: flex;
  gap: 1rem;
  padding: 0.75rem 0;
  align-items: center;
  flex-wrap: wrap;
}

.search-container {
  flex: 1;
  min-width: 150px;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: inherit;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-clear-search {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.85rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-clear-search:hover {
  color: var(--color-text-primary);
}

.preview-options {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.option-group {
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #444;
}

.option-group button {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.option-group button:hover {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
}

.option-group button.active {
  color: var(--color-primary);
  background: var(--color-border);
}

.option-group button:not(:last-child) {
  border-right: 1px solid #444;
}

.style-grid-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-top: 0.5rem;
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
  gap: 0.75rem;
}

.style-grid.grid-regular {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.style-grid.grid-large {
  grid-template-columns: repeat(2, 1fr);
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
  box-shadow: 0 0 0 1px var(--color-primary);
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
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  padding: 0.5rem;
}

.style-name {
  padding: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-primary);
  text-align: center;
  background: var(--color-bg-elevated);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section {
  margin-bottom: 1rem;
}

.section:last-child {
  margin-bottom: 0;
}

.selected-section {
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.section-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-favorite {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  background: var(--overlay-medium-dark);
  backdrop-filter: blur(4px);
  border: none;
  color: var(--color-text-disabled);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.35rem;
  line-height: 1;
  border-radius: 50%;
  width: 1.75rem;
  height: 1.75rem;
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
