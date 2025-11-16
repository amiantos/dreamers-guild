<template>
  <div class="style-picker">
    <div class="picker-header">
      <button class="btn-back" @click="$emit('close')">
        <span class="arrow">←</span> Back
      </button>
      <h3>Select Style</h3>
    </div>

    <div class="style-list">
      <div v-if="loadingStyles" class="loading">Loading styles...</div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <div v-else>
        <div v-for="category in sortedCategories" :key="category" class="style-section">
          <h4 class="section-title">{{ category }}</h4>
          <div
            v-for="style in stylesByCategory[category]"
            :key="style.name"
            class="style-item"
            :class="{ selected: selectedStyle === style.name }"
            @click="selectStyle(style)"
          >
            <div class="style-header">
              <span class="style-name">{{ style.name }}</span>
            </div>
            <div class="style-info" v-if="style.prompt || style.model">
              <span v-if="style.prompt" class="style-prompt">{{ truncate(style.prompt, 80) }}</span>
              <span v-if="style.model" class="style-model">Model: {{ style.model }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { stylesApi } from '../api/client.js'

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
    const stylesByCategory = ref({})
    const categories = ref([])

    const sortedCategories = computed(() => {
      // Put "Default" first, then alphabetically
      return categories.value.slice().sort((a, b) => {
        if (a === 'Default') return -1
        if (b === 'Default') return 1
        return a.localeCompare(b)
      })
    })

    const fetchStyles = async () => {
      try {
        loadingStyles.value = true
        error.value = null
        const response = await stylesApi.getAll()
        stylesByCategory.value = response.data.stylesByCategory
        categories.value = response.data.categories
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

    const truncate = (text, length) => {
      if (!text) return ''
      if (text.length <= length) return text
      return text.substring(0, length) + '...'
    }

    onMounted(() => {
      fetchStyles()
    })

    return {
      styles,
      loadingStyles,
      error,
      selectedStyle,
      stylesByCategory,
      sortedCategories,
      selectStyle,
      truncate
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

.style-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
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

.style-section {
  margin-bottom: 1.5rem;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #999;
  letter-spacing: 0.05em;
}

.style-item {
  padding: 1rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.style-item:hover {
  background: #252525;
  border-color: #444;
}

.style-item.selected {
  background: rgba(0, 122, 255, 0.1);
  border-color: #007AFF;
}

.style-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.style-name {
  font-weight: 500;
  color: #fff;
}

.style-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.style-prompt {
  color: #999;
  font-style: italic;
}

.style-model {
  color: #007AFF;
  font-size: 0.8125rem;
}
</style>
