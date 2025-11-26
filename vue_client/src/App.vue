<template>
  <div class="app">
    <!-- Demo Mode Banner -->
    <div v-if="isDemoMode" class="demo-banner">
      <span class="demo-icon">🧪</span>
      <span class="demo-text">Demo Mode (BETA) - Data is stored locally in your browser!</span>
      <button @click="showStorageInfo = true" class="demo-info-btn">Storage Info</button>
    </div>

    <!-- Storage Info Modal -->
    <BaseModal
      v-if="showStorageInfo"
      :show="showStorageInfo"
      @close="showStorageInfo = false"
      size="small"
    >
      <div class="storage-modal-content">
        <h2>Demo Mode (BETA) Info</h2>
        <p class="storage-warning">
          In demo mode, all your images and settings are stored in your browser's IndexedDB.
          This data can be lost if you clear your browser data. For the full experience, consider
          installing <a href="https://github.com/amiantos/dreamers-guild">the locally hosted application</a>.
        </p>
        <div v-if="storageInfo" class="storage-stats">
          <div class="stat">
            <span class="stat-label">Storage Used:</span>
            <span class="stat-value">{{ formatBytes(storageInfo.usage) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Storage Available:</span>
            <span class="stat-value">{{ formatBytes(storageInfo.quota) }}</span>
          </div>
          <div class="storage-bar">
            <div class="storage-fill" :style="{ width: storageInfo.usagePercent + '%' }"></div>
          </div>
        </div>
        <div class="storage-actions">
          <button @click="clearAllDemoData" class="btn btn-danger">
            Clear All Demo Data
          </button>
        </div>
      </div>
    </BaseModal>

    <router-view />

    <RequestGeneratorModal
      v-if="showRequestModal"
      ref="requestModalRef"
      :initialSettings="modalInitialSettings"
      :includeSeed="modalIncludeSeed"
      @close="handleCloseRequestModal"
      @submit="handleNewRequest"
    />

    <PinSetupModal
      v-if="showPinSetupModal"
      @close="showPinSetupModal = false"
      @setup-complete="handlePinSetupComplete"
    />

    <PinEntryModal
      v-if="showPinEntryModal"
      @close="handlePinEntryCancel"
      @verified="handlePinVerified"
    />
  </div>
</template>

<script>
import { ref, provide, nextTick, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import RequestGeneratorModal from './components/RequestGeneratorModal.vue'
import PinSetupModal from './components/PinSetupModal.vue'
import PinEntryModal from './components/PinEntryModal.vue'
import BaseModal from './components/BaseModal.vue'
import { settingsApi, imagesApi } from '@api'
import { useTheme } from './composables/useTheme.js'

const isDemoMode = typeof __DEMO_MODE__ !== 'undefined' && __DEMO_MODE__
const APP_NAME = 'Dreamers Guild'

export default {
  name: 'App',
  components: {
    RequestGeneratorModal,
    PinSetupModal,
    PinEntryModal,
    BaseModal
  },
  setup() {
    // Initialize theme
    const { initializeTheme } = useTheme()
    initializeTheme()

    const route = useRoute()

    // Dynamic page title based on route
    const updatePageTitle = async () => {
      const path = route.path
      const query = route.query

      // Handle image routes: /image/:id
      if (path.startsWith('/image/')) {
        const imageId = path.replace('/image/', '')
        const shortId = imageId.substring(0, 7)

        try {
          const response = await imagesApi.getById(imageId)
          const image = response.data
          if (image && image.prompt_simple) {
            // Truncate prompt to ~50 chars
            let promptExcerpt = image.prompt_simple.substring(0, 50)
            if (image.prompt_simple.length > 50) {
              promptExcerpt += '...'
            }
            document.title = `Image #${shortId} - ${promptExcerpt} - ${APP_NAME}`
          } else {
            document.title = `Image #${shortId} - ${APP_NAME}`
          }
        } catch (error) {
          document.title = `Image #${shortId} - ${APP_NAME}`
        }
        return
      }

      // Handle settings route
      if (path === '/settings') {
        document.title = `Settings - ${APP_NAME}`
        return
      }

      // Handle workers route
      if (path === '/workers') {
        document.title = `Workers - ${APP_NAME}`
        return
      }

      // Handle main library route with filters
      const titleParts = []

      // Check for request filter
      if (query.request) {
        const shortRequest = query.request.substring(0, 8)
        titleParts.push(`Request #${shortRequest}`)
      }

      // Check for lora filter
      if (query.lora) {
        const loras = query.lora.split(',')
        for (const lora of loras) {
          // Format lora ID for display
          if (/^\d+$/.test(lora)) {
            titleParts.push(`LoRA #${lora}`)
          } else {
            titleParts.push(`LoRA: ${lora}`)
          }
        }
      }

      // Check for model filter
      if (query.model) {
        titleParts.push(`Model: ${query.model}`)
      }

      // Check for keyword filters (q param)
      if (query.q) {
        const keywords = query.q.split(',').filter(k => k !== 'favorites')
        if (keywords.length > 0) {
          titleParts.push(keywords.join(', '))
        }

        // Check for favorites
        if (query.q.includes('favorites')) {
          titleParts.unshift('Favorites')
        }
      }

      if (titleParts.length > 0) {
        document.title = `${titleParts.join(' - ')} - ${APP_NAME}`
      } else {
        document.title = APP_NAME
      }
    }

    // Watch route changes and update title
    watch(
      () => route.fullPath,
      () => {
        updatePageTitle()
      },
      { immediate: true }
    )

    // Demo mode state
    const showStorageInfo = ref(false)
    const storageInfo = ref(null)

    // Initialize demo mode if applicable
    onMounted(async () => {
      if (isDemoMode) {
        try {
          const { initDemoMode, getStorageEstimate } = await import('@api')
          initDemoMode()
          storageInfo.value = await getStorageEstimate()
        } catch (err) {
          console.error('Error initializing demo mode:', err)
        }
      }
    })

    const formatBytes = (bytes) => {
      if (!bytes) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const clearAllDemoData = async () => {
      if (!confirm('Are you sure you want to clear all demo data? This cannot be undone.')) {
        return
      }
      try {
        const { clearAllStores, getStorageEstimate } = await import('@api')
        await clearAllStores()
        localStorage.removeItem('demoSettings')
        localStorage.removeItem('demoStyles')
        storageInfo.value = await getStorageEstimate()
        alert('All demo data has been cleared.')
        window.location.reload()
      } catch (err) {
        console.error('Error clearing demo data:', err)
        alert('Failed to clear demo data.')
      }
    }

    const showRequestModal = ref(false)
    const requestModalRef = ref(null)
    const modalInitialSettings = ref(null)
    const modalIncludeSeed = ref(false)
    const shouldOpenRequestsPanel = ref(false)

    // PIN protection state
    const showPinSetupModal = ref(false)
    const showPinEntryModal = ref(false)
    const settings = ref({})
    const settingsLoaded = ref(false)
    const hiddenAuthState = ref({
      isAuthenticated: false
    })
    const pendingHiddenAccess = ref(null) // Callback to run after successful PIN entry

    // Load settings on mount
    onMounted(async () => {
      await loadSettings()
    })

    const loadSettings = async () => {
      try {
        const data = await settingsApi.get()
        settings.value = data
        settingsLoaded.value = true
      } catch (error) {
        console.error('Error loading settings:', error)
        settingsLoaded.value = true // Mark as loaded even on error to prevent blocking
      }
    }

    const checkHiddenAuth = () => {
      // Wait for settings to load first
      if (!settingsLoaded.value) {
        return false
      }

      // If PIN not configured yet (null), need to set it up
      if (settings.value.hidden_pin_enabled === null) {
        return false
      }

      // If explicitly declined PIN, allow access
      if (settings.value.hidden_pin_enabled === 0) {
        return true
      }

      // If no PIN hash (shouldn't happen if enabled=1, but check anyway)
      if (!settings.value.hasPinProtection) {
        return true
      }

      // Check if authenticated (session-based, no timeout)
      return hiddenAuthState.value.isAuthenticated
    }

    const requestHiddenAccess = (callback) => {
      // Wait for settings to load
      if (!settingsLoaded.value) {
        // Settings not loaded yet, wait a bit and retry
        setTimeout(() => requestHiddenAccess(callback), 100)
        return
      }

      // Check if PIN is configured
      if (settings.value.hidden_pin_enabled === null || settings.value.hidden_pin_enabled === undefined) {
        // Not configured - show setup modal
        showPinSetupModal.value = true
        pendingHiddenAccess.value = callback
        return
      }

      // Check if already authenticated
      if (checkHiddenAuth()) {
        callback()
        return
      }

      // Need to verify PIN
      showPinEntryModal.value = true
      pendingHiddenAccess.value = callback
    }

    const handlePinSetupComplete = async ({ hasPin }) => {
      await loadSettings()
      hiddenAuthState.value.isAuthenticated = hasPin

      // Execute pending callback
      if (pendingHiddenAccess.value) {
        pendingHiddenAccess.value()
        pendingHiddenAccess.value = null
      }
    }

    const handlePinVerified = () => {
      hiddenAuthState.value.isAuthenticated = true

      // Execute pending callback
      if (pendingHiddenAccess.value) {
        pendingHiddenAccess.value()
        pendingHiddenAccess.value = null
      }
    }

    const handlePinEntryCancel = () => {
      showPinEntryModal.value = false
      pendingHiddenAccess.value = null
    }

    const clearHiddenAuth = () => {
      hiddenAuthState.value.isAuthenticated = false
    }

    const handleCloseRequestModal = () => {
      showRequestModal.value = false
      // Clear the initial settings when modal closes
      modalInitialSettings.value = null
      modalIncludeSeed.value = false
    }

    const handleNewRequest = () => {
      handleCloseRequestModal()
      // Signal to open the requests panel
      shouldOpenRequestsPanel.value = true
    }

    const openRequestModal = () => {
      showRequestModal.value = true
    }

    const loadSettingsFromImage = async (image, includeSeed = false) => {
      if (!image.full_request) {
        console.error('No settings available for this image')
        return
      }

      try {
        const settings = JSON.parse(image.full_request)

        // If including seed, get it from the full_response
        if (includeSeed && image.full_response) {
          try {
            const response = JSON.parse(image.full_response)
            if (response.seed) {
              // Add seed to params
              if (!settings.params) {
                settings.params = {}
              }
              settings.params.seed = response.seed
            }
          } catch (responseError) {
            console.error('Error parsing full_response:', responseError)
          }
        }

        // Set the initial settings and show the modal
        modalInitialSettings.value = settings
        modalIncludeSeed.value = includeSeed
        showRequestModal.value = true
      } catch (error) {
        console.error('Error loading settings from image:', error)
      }
    }

    // Provide functions to child components
    provide('loadSettingsFromImage', loadSettingsFromImage)
    provide('openRequestModal', openRequestModal)
    provide('shouldOpenRequestsPanel', shouldOpenRequestsPanel)
    provide('checkHiddenAuth', checkHiddenAuth)
    provide('requestHiddenAccess', requestHiddenAccess)
    provide('clearHiddenAuth', clearHiddenAuth)

    return {
      isDemoMode,
      showStorageInfo,
      storageInfo,
      formatBytes,
      clearAllDemoData,
      showRequestModal,
      requestModalRef,
      modalInitialSettings,
      modalIncludeSeed,
      handleCloseRequestModal,
      handleNewRequest,
      loadSettingsFromImage,
      showPinSetupModal,
      showPinEntryModal,
      handlePinSetupComplete,
      handlePinVerified,
      handlePinEntryCancel
    }
  }
}
</script>

<style>
.app {
  min-height: 100vh;
}

/* Demo Mode Banner */
.demo-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #ff6b6b, #ffa500);
  color: white;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.demo-icon {
  font-size: 1.1rem;
}

.demo-text {
  flex-shrink: 0;
}

.demo-info-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.demo-info-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Offset content when demo banner is showing */
.app:has(.demo-banner) .library-view,
.app:has(.demo-banner) .settings-view,
.app:has(.demo-banner) .workers-view {
  padding-top: 3rem;
}

/* Storage Modal Content */
.storage-modal-content {
  padding: 2rem;
}

.storage-modal-content h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: var(--color-text-primary);
}

.storage-warning {
  color: var(--color-text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.storage-stats {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.storage-stats .stat {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.storage-stats .stat-label {
  color: var(--color-text-secondary);
}

.storage-stats .stat-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.storage-bar {
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  margin-top: 1rem;
  overflow: hidden;
}

.storage-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #ff9800);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.storage-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #c82333;
}
</style>
