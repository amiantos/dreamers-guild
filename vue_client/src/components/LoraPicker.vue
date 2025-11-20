<template>
  <div class="lora-picker">
    <!-- Header -->
    <div class="picker-header">
      <button class="btn-back" @click="$emit('close')">
        <span class="arrow">←</span> Back
      </button>
      <h3>LoRAs</h3>
      <button class="btn-filter" @click="showFilter = !showFilter">
        <i class="fas fa-filter"></i>
      </button>
    </div>

    <!-- Filter Panel -->
    <div v-if="showFilter" class="filter-panel">
      <div class="filter-section">
        <h4>Base Models</h4>
        <div class="filter-checkboxes">
          <label v-for="filter in baseModelOptions" :key="filter" class="checkbox-label">
            <input
              type="checkbox"
              :value="filter"
              v-model="selectedFilters"
              @change="onFiltersChange"
            />
            <span>{{ filter }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'browse' }]"
        @click="activeTab = 'browse'"
      >
        Browse
      </button>
      <button
        :class="['tab', { active: activeTab === 'selected' }]"
        @click="activeTab = 'selected'"
      >
        Selected ({{ selectedLoras.length }})
      </button>
      <button
        :class="['tab', { active: activeTab === 'favorites' }]"
        @click="activeTab = 'favorites'"
      >
        Favorites
      </button>
      <button
        :class="['tab', { active: activeTab === 'recent' }]"
        @click="activeTab = 'recent'"
      >
        Recent
      </button>
    </div>

    <!-- Search Bar (for Browse, Favorites, Recent) -->
    <div v-if="activeTab !== 'selected'" class="search-container">
      <input
        type="text"
        v-model="searchQuery"
        :placeholder="searchPlaceholder"
        class="search-input"
        @input="onSearchInput"
      />
      <button v-if="searchQuery" class="btn-clear-search" @click="clearSearch">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Browse Tab -->
      <div v-if="activeTab === 'browse'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading LoRAs...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>{{ error }}</p>
          <button class="btn-retry" @click="retry">Retry</button>
        </div>

        <div v-else-if="browseResults.length === 0" class="empty-state">
          <i class="fas fa-search"></i>
          <p>No LoRAs found</p>
        </div>

        <div v-else class="lora-grid">
          <LoraCard
            v-for="lora in browseResults"
            :key="lora.id"
            :lora="lora"
            :isFavorite="favorites.includes(lora.id)"
            :nsfwEnabled="nsfwEnabled"
            @click="showDetails(lora)"
            @toggleFavorite="toggleFavorite"
          />
        </div>

        <!-- Pagination -->
        <div v-if="hasNextPage || hasPreviousPage" class="pagination">
          <button
            class="btn-page"
            :disabled="!hasPreviousPage || loading"
            @click="goToPreviousPage"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="page-indicator">Page {{ currentPage }}</span>
          <button
            class="btn-page"
            :disabled="!hasNextPage || loading"
            @click="goToNextPage"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- Selected Tab -->
      <div v-if="activeTab === 'selected'" class="tab-content">
        <div v-if="selectedLoras.length === 0" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>No LoRAs selected</p>
          <p class="empty-hint">Browse to add some!</p>
        </div>

        <div v-else-if="selectedLoras.length >= maxLoras" class="warning-banner">
          <i class="fas fa-exclamation-circle"></i>
          Maximum {{ maxLoras }} LoRAs reached
        </div>

        <div class="selected-list">
          <LoraControls
            v-for="(lora, index) in selectedLoras"
            :key="`${lora.versionId}-${index}`"
            :lora="lora"
            @update="updateLora(index, $event)"
            @remove="removeLora(index)"
            @showInfo="showDetails"
            @addTriggerWord="addTriggerWord"
          />
        </div>
      </div>

      <!-- Favorites Tab -->
      <div v-if="activeTab === 'favorites'" class="tab-content">
        <div v-if="favoritesLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading favorites...</p>
        </div>

        <div v-else-if="filteredFavorites.length === 0" class="empty-state">
          <i class="fas fa-heart"></i>
          <p>No favorite LoRAs yet</p>
        </div>

        <div v-else class="lora-grid">
          <LoraCard
            v-for="lora in filteredFavorites"
            :key="lora.id"
            :lora="lora"
            :isFavorite="true"
            :nsfwEnabled="nsfwEnabled"
            @click="showDetails(lora)"
            @toggleFavorite="toggleFavorite"
          />
        </div>
      </div>

      <!-- Recent Tab -->
      <div v-if="activeTab === 'recent'" class="tab-content">
        <div v-if="recentLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading recent LoRAs...</p>
        </div>

        <div v-else-if="filteredRecent.length === 0" class="empty-state">
          <i class="fas fa-clock"></i>
          <p>No recently used LoRAs</p>
        </div>

        <div v-else class="lora-grid">
          <LoraCard
            v-for="item in filteredRecent"
            :key="item.versionId"
            :lora="item.model"
            :isFavorite="favorites.includes(item.model.id)"
            :nsfwEnabled="nsfwEnabled"
            @click="showDetails(item.model)"
            @toggleFavorite="toggleFavorite"
          />
        </div>
      </div>
    </div>

    <!-- LoRA Details Overlay -->
    <LoraDetails
      v-if="showDetailsOverlay"
      :lora="selectedLoraForDetails"
      :nsfwEnabled="nsfwEnabled"
      @close="showDetailsOverlay = false"
      @addLora="onAddLora"
      @toggleFavorite="toggleFavorite"
    />

    <!-- Footer -->
    <div class="picker-footer">
      <button class="btn-apply" @click="applySelection">
        Apply {{ selectedLoras.length }} LoRA{{ selectedLoras.length !== 1 ? 's' : '' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import LoraCard from './LoraCard.vue'
import LoraControls from './LoraControls.vue'
import LoraDetails from './LoraDetails.vue'
import { useLoraCache, useLoraFavorites, useLoraRecent } from '../composables/useLoraCache'
import { LORA_CONSTANTS } from '../models/Lora'
import { useSettingsStore } from '../stores/settingsStore'

export default {
  name: 'LoraPicker',
  components: {
    LoraCard,
    LoraControls,
    LoraDetails
  },
  props: {
    currentLoras: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'update'],
  setup(props, { emit }) {
    const settingsStore = useSettingsStore()

    // Composables
    const {
      results,
      loading,
      error,
      currentPage,
      baseModelFilters,
      nsfwEnabled,
      hasNextPage,
      hasPreviousPage,
      search,
      searchImmediate,
      goToNextPage,
      goToPreviousPage,
      updateFilters
    } = useLoraCache()

    const {
      favorites,
      loading: favoritesLoading,
      loadFavorites,
      toggleFavorite: toggleFav
    } = useLoraFavorites()

    const {
      recent,
      loading: recentLoading,
      loadRecent
    } = useLoraRecent()

    // State
    const activeTab = ref('browse')
    const showFilter = ref(false)
    const searchQuery = ref('')
    const selectedLoras = ref([...props.currentLoras])
    const selectedFilters = ref([...baseModelFilters.value])
    const showDetailsOverlay = ref(false)
    const selectedLoraForDetails = ref(null)
    const maxLoras = LORA_CONSTANTS.MAX_LORAS

    // Favorites and recent as embedings (full data)
    const favoritesEmbeddings = ref([])
    const recentEmbeddings = ref([])

    // Computed
    const browseResults = computed(() => results.value)

    const searchPlaceholder = computed(() => {
      switch (activeTab.value) {
        case 'browse':
          return 'Search LoRAs on CivitAI...'
        case 'favorites':
          return 'Search favorites...'
        case 'recent':
          return 'Search recent...'
        default:
          return 'Search...'
      }
    })

    const nsfwEnabledComputed = computed(() => {
      return settingsStore.workerPreferences?.nsfw || false
    })

    const filteredFavorites = computed(() => {
      if (!searchQuery.value) return favoritesEmbeddings.value

      const query = searchQuery.value.toLowerCase()
      return favoritesEmbeddings.value.filter(lora =>
        lora.name.toLowerCase().includes(query) ||
        lora.description?.toLowerCase().includes(query)
      )
    })

    const filteredRecent = computed(() => {
      if (!searchQuery.value) return recentEmbeddings.value

      const query = searchQuery.value.toLowerCase()
      return recentEmbeddings.value.filter(item =>
        item.model.name.toLowerCase().includes(query) ||
        item.model.description?.toLowerCase().includes(query)
      )
    })

    // Base model options
    const baseModelOptions = [
      'SD 1.x',
      'SD 2.x',
      'SDXL',
      'Pony',
      'Flux',
      'NoobAI',
      'Illustrious',
      'NSFW'
    ]

    // Methods
    const onSearchInput = () => {
      if (activeTab.value === 'browse') {
        search(searchQuery.value)
      }
      // For favorites and recent, filtering is done via computed properties
    }

    const clearSearch = () => {
      searchQuery.value = ''
      if (activeTab.value === 'browse') {
        search('')
      }
    }

    const onFiltersChange = () => {
      const nsfw = selectedFilters.value.includes('NSFW')
      const modelFilters = selectedFilters.value.filter(f => f !== 'NSFW')
      updateFilters(modelFilters, nsfw)
    }

    const showDetails = (lora) => {
      selectedLoraForDetails.value = lora
      showDetailsOverlay.value = true
    }

    const onAddLora = (lora) => {
      if (selectedLoras.value.length >= maxLoras) {
        alert(`Maximum ${maxLoras} LoRAs allowed`)
        return
      }

      // Check if already added (by versionId)
      const exists = selectedLoras.value.some(l => l.versionId === lora.versionId)
      if (exists) {
        return
      }

      selectedLoras.value.push(lora)
      activeTab.value = 'selected'
    }

    const updateLora = (index, updatedLora) => {
      selectedLoras.value[index] = updatedLora
    }

    const removeLora = (index) => {
      selectedLoras.value.splice(index, 1)
    }

    const toggleFavorite = async (loraId) => {
      await toggleFav(loraId)
      // Reload favorites to update the list
      await loadFavoritesData()
    }

    const addTriggerWord = (word) => {
      // This will be handled by the parent component (RequestGeneratorModal)
      // For now, just emit an event or handle it differently
      console.log('Add trigger word to prompt:', word)
    }

    const applySelection = () => {
      emit('update', selectedLoras.value)
      emit('close')
    }

    const retry = () => {
      searchImmediate(searchQuery.value)
    }

    // Load favorites and recent data
    const loadFavoritesData = async () => {
      await loadFavorites()
      // TODO: Fetch full embedding data for favorites
      // For now, we'll need to implement a way to cache or fetch these
      favoritesEmbeddings.value = []
    }

    const loadRecentData = async () => {
      await loadRecent()
      // Recent already has full model data
      recentEmbeddings.value = recent.value
    }

    // Watch tab changes
    watch(activeTab, (newTab) => {
      searchQuery.value = ''

      if (newTab === 'browse' && browseResults.value.length === 0) {
        searchImmediate('')
      } else if (newTab === 'favorites' && favoritesEmbeddings.value.length === 0) {
        loadFavoritesData()
      } else if (newTab === 'recent' && recentEmbeddings.value.length === 0) {
        loadRecentData()
      }
    })

    // Initialize
    onMounted(() => {
      // Load initial browse results
      searchImmediate('')

      // Update NSFW from settings
      nsfwEnabled.value = nsfwEnabledComputed.value
      if (nsfwEnabledComputed.value && !selectedFilters.value.includes('NSFW')) {
        selectedFilters.value.push('NSFW')
      }
    })

    return {
      // State
      activeTab,
      showFilter,
      searchQuery,
      selectedLoras,
      selectedFilters,
      showDetailsOverlay,
      selectedLoraForDetails,
      maxLoras,

      // Computed
      browseResults,
      searchPlaceholder,
      nsfwEnabled: nsfwEnabledComputed,
      filteredFavorites,
      filteredRecent,
      baseModelOptions,

      // From composables
      loading,
      error,
      currentPage,
      hasNextPage,
      hasPreviousPage,
      favorites,
      favoritesLoading,
      recentLoading,

      // Methods
      onSearchInput,
      clearSearch,
      onFiltersChange,
      showDetails,
      onAddLora,
      updateLora,
      removeLora,
      toggleFavorite,
      addTriggerWord,
      applySelection,
      retry,
      goToNextPage,
      goToPreviousPage
    }
  }
}
</script>

<style scoped>
.lora-picker {
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
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #333;
  background: #1a1a1a;
}

.picker-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.btn-back,
.btn-filter {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px 12px;
  font-size: 14px;
  transition: background 0.2s;
  border-radius: 4px;
}

.btn-back:hover,
.btn-filter:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-back .arrow {
  font-size: 18px;
  margin-right: 4px;
}

.filter-panel {
  background: #2a2a2a;
  padding: 16px;
  border-bottom: 1px solid #333;
}

.filter-section h4 {
  margin: 0 0 12px 0;
  color: white;
  font-size: 14px;
  font-weight: bold;
}

.filter-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #333;
  background: #1a1a1a;
}

.tab {
  flex: 1;
  background: none;
  border: none;
  color: #999;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab:hover {
  color: white;
  background: rgba(255, 255, 255, 0.05);
}

.tab.active {
  color: white;
  border-bottom-color: #4fc3f7;
  background: rgba(79, 195, 247, 0.1);
}

.search-container {
  position: relative;
  padding: 16px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #4fc3f7;
}

.btn-clear-search {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
}

.btn-clear-search:hover {
  color: white;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-content {
  min-height: 100%;
}

.lora-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  padding-bottom: 20px;
}

@media (max-width: 768px) {
  .lora-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.loading-state i,
.error-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #666;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #333;
  border-top-color: #4fc3f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  color: #ff5252;
}

.btn-retry {
  margin-top: 16px;
  background: #4fc3f7;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
}

.btn-retry:hover {
  background: #29b6f6;
}

.empty-hint {
  font-size: 13px;
  margin-top: 8px;
}

.warning-banner {
  background: #ff9800;
  color: white;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: bold;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
}

.btn-page {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 8px 16px;
  transition: background 0.2s;
}

.btn-page:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-indicator {
  color: white;
  font-size: 14px;
}

.picker-footer {
  padding: 16px;
  border-top: 1px solid #333;
  background: #1a1a1a;
}

.btn-apply {
  width: 100%;
  background: #4fc3f7;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-apply:hover {
  background: #29b6f6;
}
</style>
