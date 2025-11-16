<template>
  <div class="style-picker">
    <div class="picker-header">
      <button class="btn-back" @click="$emit('close')">
        <span class="arrow">←</span> Back
      </button>
      <h3>Styles</h3>
      <button class="btn-menu" @click="showMenu = !showMenu" title="Preview Options">
        ⋯
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

      <div v-else class="style-grid" :class="`grid-${previewOptions.size}`">
        <!-- None option -->
        <div
          class="style-card"
          :class="{ selected: !selectedStyle || selectedStyle === 'None' }"
          @click="selectStyle({ name: 'None' })"
        >
          <div class="style-preview no-preview">
            <span class="no-preview-text">None</span>
          </div>
          <div class="style-name">None</div>
        </div>

        <!-- All other styles -->
        <div
          v-for="style in filteredStyles"
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
            <div v-if="!getPreviewUrl(style)" class="no-preview">
              <span class="no-preview-text">{{ style.name }}</span>
            </div>
          </div>
          <div class="style-name">{{ style.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { stylesApi, settingsApi } from '../api/client.js'

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
        if (response.data && response.data.default_params) {
          try {
            const params = JSON.parse(response.data.default_params)
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
        const currentParams = response.data.default_params
          ? JSON.parse(response.data.default_params)
          : {}

        currentParams.stylePreviewOptions = { ...previewOptions }

        await settingsApi.update({
          defaultParams: currentParams
        })
      } catch (error) {
        console.error('Error saving preview preferences:', error)
      }
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
      selectStyle,
      getPreviewUrl,
      getPreviewStyle
    }
  }
}
</script>

<style scoped>
.style-picker {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  z-index: 10;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.picker-header {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  gap: 1rem;
  flex-shrink: 0;
}

.btn-back {
  background: transparent;
  border: none;
  color: #007AFF;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  transition: opacity 0.2s;
}

.btn-back:hover {
  opacity: 0.7;
}

.arrow {
  font-size: 1.25rem;
}

.picker-header h3 {
  margin: 0;
  font-size: 1.25rem;
  flex: 1;
}

.btn-menu {
  background: transparent;
  border: none;
  color: #999;
  font-size: 1.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s;
  line-height: 1;
}

.btn-menu:hover {
  color: #fff;
}

.options-menu {
  background: #0f0f0f;
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
  color: #999;
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
  background: #1a1a1a;
}

.menu-option input[type="radio"] {
  width: auto;
  cursor: pointer;
}

.menu-option span {
  color: #fff;
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
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #007AFF;
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
  color: #999;
}

.error {
  color: #ff3b30;
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
  background: #0f0f0f;
  border: 2px solid #333;
  transition: all 0.2s;
}

.style-card:hover {
  border-color: #444;
  transform: translateY(-2px);
}

.style-card.selected {
  border-color: #007AFF;
  box-shadow: 0 0 0 1px #007AFF;
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
  background-color: #0a0a0a;
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
  color: #666;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
  padding: 1rem;
}

.style-name {
  padding: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
  text-align: center;
  background: #0f0f0f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
