<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Select Model</h3>
          <button
            class="btn-refresh"
            @click="refreshModels"
            :disabled="loadingModels"
            title="Refresh model list from server"
          >
            {{ loadingModels ? '...' : '↻' }}
          </button>
          <button class="btn-close" @click="$emit('close')" title="Close">
            ×
          </button>
        </div>

        <div class="search-container">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search models..."
            class="search-input"
          />
        </div>

        <div class="model-list">
          <div v-if="loadingModels" class="loading">Loading models...</div>

          <div v-else-if="filteredModels.length === 0" class="no-results">
            No models found
          </div>

          <div v-else>
            <div v-if="favoriteModels.length > 0" class="model-section">
              <h4 class="section-title">Favorites</h4>
              <div
                v-for="model in favoriteModels"
                :key="model.name"
                class="model-item"
                :class="{ selected: selectedModel === model.name }"
                @click="selectModel(model)"
              >
                <div class="model-header-item">
                  <span class="model-name">{{ model.name }}</span>
                  <button
                    class="btn-favorite active"
                    @click.stop="toggleFavorite(model.name)"
                    title="Remove from favorites"
                  >
                    <i class="fa-solid fa-star"></i>
                  </button>
                </div>
                <div class="model-info">
                  <span>Workers: {{ model.count || 0 }}</span>
                  <span>Queue: {{ model.queued || 0 }}</span>
                  <span v-if="model.eta">Wait: {{ model.eta }}s</span>
                </div>
              </div>
            </div>

            <div class="model-section">
              <h4 class="section-title">All Models</h4>
              <div
                v-for="model in nonFavoriteModels"
                :key="model.name"
                class="model-item"
                :class="{ selected: selectedModel === model.name }"
                @click="selectModel(model)"
              >
                <div class="model-header-item">
                  <span class="model-name">{{ model.name }}</span>
                  <button
                    class="btn-favorite"
                    @click.stop="toggleFavorite(model.name)"
                    title="Add to favorites"
                  >
                    <i class="fa-regular fa-star"></i>
                  </button>
                </div>
                <div class="model-info">
                  <span>Workers: {{ model.count || 0 }}</span>
                  <span>Queue: {{ model.queued || 0 }}</span>
                  <span v-if="model.eta">Wait: {{ model.eta }}s</span>
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
import { ref, computed, onMounted } from 'vue'
import { settingsApi } from '@api'
import { useModelCache } from '../composables/useModelCache.js'

export default {
  name: 'ModelPicker',
  props: {
    currentModel: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'select'],
  setup(props, { emit }) {
    // Use model cache composable
    const { models, loading: loadingModels, fetchModels } = useModelCache()

    const searchQuery = ref('')
    const selectedModel = ref(props.currentModel)
    const favorites = ref([])

    const filteredModels = computed(() => {
      if (!searchQuery.value) {
        return models.value
      }
      const query = searchQuery.value.toLowerCase()
      return models.value.filter(model =>
        model.name.toLowerCase().includes(query)
      )
    })

    const favoriteModels = computed(() => {
      return filteredModels.value.filter(model => favorites.value.includes(model.name))
    })

    const nonFavoriteModels = computed(() => {
      return filteredModels.value.filter(model => !favorites.value.includes(model.name))
    })

    const loadFavorites = async () => {
      try {
        const response = await settingsApi.get()
        if (response && response.favorite_models) {
          try {
            const parsed = JSON.parse(response.favorite_models)
            favorites.value = Array.isArray(parsed) ? parsed : []
          } catch (parseError) {
            console.error('Error parsing favorite_models:', parseError)
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
        await settingsApi.update({ favoriteModels: favorites.value })
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }

    const toggleFavorite = (modelName) => {
      const index = favorites.value.indexOf(modelName)
      if (index > -1) {
        favorites.value.splice(index, 1)
      } else {
        favorites.value.push(modelName)
      }
      saveFavorites()
    }

    const refreshModels = () => {
      fetchModels(true)
    }

    const selectModel = (model) => {
      selectedModel.value = model.name
      emit('select', model.name)
      emit('close')
    }

    onMounted(async () => {
      await loadFavorites()
      await fetchModels()
    })

    return {
      models,
      loadingModels,
      searchQuery,
      selectedModel,
      filteredModels,
      favoriteModels,
      nonFavoriteModels,
      selectModel,
      toggleFavorite,
      refreshModels
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
  max-width: 600px;
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
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  flex: 1;
}

.btn-refresh {
  background: transparent;
  border: 1px solid #333;
  color: var(--color-primary);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s;
  min-width: 40px;
}

.btn-refresh:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.search-container {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #333;
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

.model-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

.loading,
.no-results {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-tertiary);
}

.model-section {
  margin-bottom: 1.5rem;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.05em;
}

.model-item {
  padding: 1rem;
  background: var(--color-bg-elevated);
  border: 1px solid #333;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.model-item:hover {
  background: #252525;
  border-color: var(--color-border-light);
}

.model-item.selected {
  background: rgba(0, 122, 255, 0.1);
  border-color: var(--color-primary);
}

.model-header-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.model-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.btn-favorite {
  background: transparent;
  border: none;
  color: var(--color-text-disabled);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.2s;
}

.btn-favorite:hover {
  color: var(--color-warning-gold);
}

.btn-favorite.active {
  color: var(--color-warning-gold);
}

.model-info {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
}

.model-info span {
  display: flex;
  align-items: center;
}
</style>
