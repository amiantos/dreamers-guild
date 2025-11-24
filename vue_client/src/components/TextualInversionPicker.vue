<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-content">
        <!-- Header -->
        <div class="modal-header">
          <h3>Textual Inversions</h3>
          <button class="btn-close" @click="$emit('close')" title="Close">
            ×
          </button>
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
    <div class="search-container">
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

      <!-- Filter Panel - Only for Browse Tab -->
      <div v-if="activeTab === 'browse'" class="filter-row-single">
        <!-- Base Model Chips -->
        <button
          v-for="filter in baseModelFilterOptions"
          :key="filter"
          :class="['model-chip', { active: selectedFilters.includes(filter) }]"
          @click="toggleFilter(filter)"
        >
          {{ filter }}
        </button>

        <!-- Divider -->
        <div class="filter-divider"></div>

        <!-- Sort Dropdown -->
        <select
          v-model="sortOrder"
          @change="onSortChange"
          class="sort-select"
        >
          <option v-for="option in sortOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>

        <!-- NSFW Toggle -->
        <button
          :class="['model-chip', { active: selectedFilters.includes('NSFW') }]"
          @click="toggleFilter('NSFW')"
        >
          NSFW
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Browse Tab -->
      <div v-if="activeTab === 'browse'" class="tab-content">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading Textual Inversions...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>{{ error }}</p>
          <button class="btn-retry" @click="retry">Retry</button>
        </div>

        <div v-else-if="browseResults.length === 0" class="empty-state">
          <i class="fas fa-search"></i>
          <p>No Textual Inversions found</p>
        </div>

        <div v-else class="ti-grid">
          <TextualInversionCard
            v-for="ti in browseResults"
            :key="ti.id"
            :ti="ti"
            :isFavorite="favorites.includes(ti.id)"
            :nsfwEnabled="nsfwEnabled"
            @click="showDetails(ti)"
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

      <!-- Favorites Tab -->
      <div v-if="activeTab === 'favorites'" class="tab-content">
        <div v-if="favoritesLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading favorites...</p>
        </div>

        <div v-else-if="filteredFavorites.length === 0" class="empty-state">
          <i class="fas fa-heart"></i>
          <p>No favorite Textual Inversions yet</p>
        </div>

        <div v-else class="ti-grid">
          <TextualInversionCard
            v-for="ti in filteredFavorites"
            :key="ti.id"
            :ti="ti"
            :isFavorite="true"
            :nsfwEnabled="nsfwEnabled"
            @click="showDetails(ti)"
            @toggleFavorite="toggleFavorite"
          />
        </div>
      </div>

      <!-- Recent Tab -->
      <div v-if="activeTab === 'recent'" class="tab-content">
        <div v-if="recentLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading recent Textual Inversions...</p>
        </div>

        <div v-else-if="filteredRecent.length === 0" class="empty-state">
          <i class="fas fa-clock"></i>
          <p>No recently used Textual Inversions</p>
        </div>

        <div v-else class="ti-grid">
          <TextualInversionCard
            v-for="item in filteredRecent"
            :key="item.versionId"
            :ti="item.model"
            :isFavorite="favorites.includes(item.model.id)"
            :nsfwEnabled="nsfwEnabled"
            @click="showDetails(item.model)"
            @toggleFavorite="toggleFavorite"
          />
        </div>
      </div>
    </div>

    <!-- Textual Inversion Details Overlay -->
    <TextualInversionDetails
      v-if="showDetailsOverlay"
      :ti="selectedTiForDetails"
      :currentTis="currentTis"
      :nsfwEnabled="nsfwEnabled"
      @close="showDetailsOverlay = false"
      @addTi="onAddTi"
      @removeTi="onRemoveTi"
      @toggleFavorite="toggleFavorite"
    />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import TextualInversionCard from './TextualInversionCard.vue'
import TextualInversionDetails from './TextualInversionDetails.vue'
import { useTextualInversionCache, useTextualInversionFavorites, useTextualInversionRecent } from '../composables/useTextualInversionCache'
import { TI_CONSTANTS } from '../models/TextualInversion'
import { useSettingsStore } from '../stores/settingsStore'
import { getTiById, getTiByVersionId } from '../api/civitai'

export default {
  name: 'TextualInversionPicker',
  components: {
    TextualInversionCard,
    TextualInversionDetails
  },
  props: {
    currentTis: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'add', 'remove', 'updateTi'],
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
      sortOrder,
      hasNextPage,
      hasPreviousPage,
      search,
      searchImmediate,
      goToNextPage,
      goToPreviousPage,
      updateFilters,
      updateSort
    } = useTextualInversionCache()

    const {
      favorites,
      loading: favoritesLoading,
      loadFavorites,
      toggleFavorite: toggleFav
    } = useTextualInversionFavorites()

    const {
      recent,
      loading: recentLoading,
      loadRecent
    } = useTextualInversionRecent()

    // State
    const activeTab = ref('browse')
    const searchQuery = ref('')
    const selectedFilters = ref([...baseModelFilters.value])
    const showDetailsOverlay = ref(false)
    const selectedTiForDetails = ref(null)
    // No max limit for TIs

    // Favorites and recent as embedings (full data)
    const favoritesEmbeddings = ref([])
    const recentEmbeddings = ref([])

    // Computed
    const browseResults = computed(() => results.value)

    const searchPlaceholder = computed(() => {
      switch (activeTab.value) {
        case 'browse':
          return 'Search Textual Inversions on CivitAI...'
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
      return favoritesEmbeddings.value.filter(ti =>
        ti.name.toLowerCase().includes(query) ||
        ti.description?.toLowerCase().includes(query)
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

    // Base model options (without NSFW - handled separately)
    const baseModelFilterOptions = [
      'SD 1.x',
      'SD 2.x',
      'SDXL',
      'Pony',
      'Flux',
      'NoobAI',
      'Illustrious'
    ]

    // Sort options (matches CivitAI API)
    const sortOptions = [
      'Highest Rated',
      'Most Downloaded',
      'Newest'
    ]

    // Methods
    const onSearchInput = () => {
      if (activeTab.value === 'browse') {
        search(searchQuery.value)
      }
      // For favorites and recent, filtering is done via computed properties
    }

    const onSortChange = (event) => {
      updateSort(event.target.value)
    }

    const clearSearch = () => {
      searchQuery.value = ''
      if (activeTab.value === 'browse') {
        search('')
      }
    }

    const toggleFilter = (filter) => {
      const index = selectedFilters.value.indexOf(filter)
      if (index > -1) {
        selectedFilters.value.splice(index, 1)
      } else {
        selectedFilters.value.push(filter)
      }

      const nsfw = selectedFilters.value.includes('NSFW')
      const modelFilters = selectedFilters.value.filter(f => f !== 'NSFW')
      updateFilters(modelFilters, nsfw)
    }

    const showDetails = async (ti) => {
      // Fetch full model data to get complete metadata, file info, and all versions
      try {
        const fullModelData = await getTiById(ti.id)
        // Preserve the versionId from the clicked TI so details modal shows the correct version
        fullModelData.versionId = ti.versionId || fullModelData.versionId
        selectedTiForDetails.value = fullModelData
        showDetailsOverlay.value = true
      } catch (error) {
        console.error('Error fetching full model data:', error)
        // Fallback to using the partial data from search
        selectedTiForDetails.value = ti
        showDetailsOverlay.value = true
      }
    }

    const onAddTi = async (ti) => {
      // No max limit for TIs

      // Check if already added (by versionId)
      const exists = props.currentTis.some(t => t.versionId === ti.versionId)
      if (exists) {
        return
      }

      // Note: Cache is automatically populated by server when fetching via CivitAI API

      // Emit directly to parent to add to request
      emit('add', ti)
    }

    const onRemoveTi = (versionId) => {
      // Find the TI in currentTis and emit removal
      const index = props.currentTis.findIndex(t => t.versionId === versionId)
      if (index !== -1) {
        // Emit to parent to remove by index
        emit('remove', index)
      }
    }

    const toggleFavorite = async (tiId) => {
      await toggleFav(tiId)
      // Reload favorites to update the list
      await loadFavoritesData()
    }

    const retry = () => {
      searchImmediate(searchQuery.value)
    }

    // Load favorites and recent data
    const loadFavoritesData = async () => {
      await loadFavorites()

      // Fetch full embedding data for each favorite Textual Inversion
      const favoriteIds = favorites.value
      if (!favoriteIds || favoriteIds.length === 0) {
        favoritesEmbeddings.value = []
        return
      }

      try {
        const embeddings = await Promise.all(
          favoriteIds.map(async (id) => {
            try {
              const ti = await getTiById(id)
              return ti
            } catch (error) {
              console.error(`Failed to fetch favorite Textual Inversion ${id}:`, error)
              return null
            }
          })
        )

        // Filter out any failed fetches
        favoritesEmbeddings.value = embeddings.filter(e => e !== null)
      } catch (error) {
        console.error('Error loading favorites data:', error)
        favoritesEmbeddings.value = []
      }
    }

    const loadRecentData = async () => {
      await loadRecent()

      // Hydrate recent Textual Inversions from cache (recent now only stores versionId + timestamp)
      const recentItems = recent.value
      if (!recentItems || recentItems.length === 0) {
        recentEmbeddings.value = []
        return
      }

      try {
        const embeddings = await Promise.all(
          recentItems.map(async (item) => {
            try {
              const ti = await getTiByVersionId(item.versionId)
              // Recreate the expected structure with model property
              return {
                versionId: item.versionId,
                timestamp: item.timestamp,
                model: ti
              }
            } catch (error) {
              console.error(`Failed to fetch recent Textual Inversion ${item.versionId}:`, error)
              return null
            }
          })
        )

        // Filter out any failed fetches
        recentEmbeddings.value = embeddings.filter(e => e !== null)
      } catch (error) {
        console.error('Error loading recent data:', error)
        recentEmbeddings.value = []
      }
    }

    // Watch tab changes
    watch(activeTab, async (newTab) => {
      searchQuery.value = ''

      if (newTab === 'browse' && browseResults.value.length === 0) {
        searchImmediate('')
      } else if (newTab === 'favorites' && favoritesEmbeddings.value.length === 0) {
        await loadFavoritesData()
      } else if (newTab === 'recent' && recentEmbeddings.value.length === 0) {
        try {
          await loadRecentData()
        } catch (error) {
          console.error('Error loading recent Textual Inversions in watch handler:', error)
        }
      }
    })

    // Initialize
    onMounted(async () => {
      // Load initial browse results
      searchImmediate('')

      // Load favorites
      await loadFavorites()

      // Update NSFW from settings
      nsfwEnabled.value = nsfwEnabledComputed.value
      if (nsfwEnabledComputed.value && !selectedFilters.value.includes('NSFW')) {
        selectedFilters.value.push('NSFW')
      }
    })

    return {
      // State
      activeTab,
      searchQuery,
      selectedFilters,
      showDetailsOverlay,
      selectedTiForDetails,
      // maxTis removed - no limit for TIs

      // Computed
      browseResults,
      searchPlaceholder,
      nsfwEnabled: nsfwEnabledComputed,
      filteredFavorites,
      filteredRecent,
      baseModelFilterOptions,
      sortOptions,

      // From composables
      loading,
      error,
      currentPage,
      hasNextPage,
      hasPreviousPage,
      favorites,
      favoritesLoading,
      recentLoading,
      sortOrder,

      // Methods
      onSearchInput,
      onSortChange,
      clearSearch,
      toggleFilter,
      showDetails,
      onAddTi,
      onRemoveTi,
      toggleFavorite,
      retry,
      goToNextPage,
      goToPreviousPage
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
  max-width: 900px;
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
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #333;
  background: var(--color-surface);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: white;
  flex: 1;
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

.filter-row-single {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.model-chip {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 4px 12px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.model-chip:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-lighter);
}

.model-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.filter-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 4px;
}

.sort-select {
  padding: 4px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  min-width: 130px;
}

.sort-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.sort-select option {
  background: var(--color-surface);
  color: white;
}

@media (max-width: 768px) {
  .filter-row-single {
    gap: 6px;
  }

  .model-chip {
    font-size: 11px;
    padding: 3px 10px;
  }

  .sort-select {
    min-width: 110px;
    font-size: 11px;
  }

  .nsfw-checkbox {
    font-size: 11px;
  }
}

.tabs {
  display: flex;
  border-bottom: 1px solid #333;
  background: var(--color-surface);
}

.tab {
  flex: 1;
  background: none;
  border: none;
  color: var(--color-text-tertiary);
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
  border-bottom-color: var(--color-primary);
  background: rgba(88, 114, 151, 0.1);
}

.search-container {
  position: relative;
  padding: 16px;
  background: var(--color-surface);
  border-bottom: 1px solid #333;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  background: var(--color-surface-hover);
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-clear-search {
  position: absolute;
  right: 24px;
  top: 26px;
  background: none;
  border: none;
  color: var(--color-text-tertiary);
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

.ti-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding-bottom: 20px;
}

@media (max-width: 768px) {
  .ti-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text-tertiary);
}

.loading-state i,
.error-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  color: var(--color-text-disabled);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #333;
  border-top-color: var(--color-primary);
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
  background: var(--color-primary);
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
</style>
