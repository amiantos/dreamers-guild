<template>
  <div class="app">
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
      :initialAlbumSlug="modalInitialAlbumSlug"
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

    <WelcomeModal
      v-if="showWelcomeModal"
      :show="showWelcomeModal"
      :sharedKeyMode="!!sharedKeyInfo"
      :sharedKeyName="sharedKeyInfo?.name"
      @close="handleWelcomeModalClose"
    />

    <ToastContainer />
  </div>
</template>

<script>
import { ref, provide, nextTick, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import RequestGeneratorModal from './components/RequestGeneratorModal.vue'
import PinSetupModal from './components/PinSetupModal.vue'
import PinEntryModal from './components/PinEntryModal.vue'
import BaseModal from './components/BaseModal.vue'
import WelcomeModal from './components/WelcomeModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import { settingsApi, imagesApi } from '@api'
import { useTheme } from './composables/useTheme.js'
import { useAuthStore } from './stores/authStore.js'

const isDemoMode = typeof __DEMO_MODE__ !== 'undefined' && __DEMO_MODE__
const APP_NAME = 'Dreamers Guild'

export default {
  name: 'App',
  components: {
    RequestGeneratorModal,
    PinSetupModal,
    PinEntryModal,
    BaseModal,
    WelcomeModal,
    ToastContainer
  },
  setup() {
    // Initialize theme
    const { initializeTheme } = useTheme()
    initializeTheme()

    const route = useRoute()
    const router = useRouter()

    // Shared key state (for ?api_key= links)
    const sharedKeyInfo = ref(null)

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

    // Welcome modal state
    const showWelcomeModal = ref(false)
    const WELCOME_DISMISSED_KEY = 'welcomeModalDismissed'

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
      // Note: Welcome modal is shown after settings load and shared key check
      // See loadSettings() -> processSharedKeyFromUrl()
    })

    const handleWelcomeModalClose = ({ dontShowAgain }) => {
      showWelcomeModal.value = false
      sharedKeyInfo.value = null // Clear shared key info after modal closes
      if (dontShowAgain) {
        localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
      }
    }

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
    const modalInitialAlbumSlug = ref(null)
    const shouldOpenRequestsPanel = ref(false)

    // Use auth store for PIN protection
    const authStore = useAuthStore()
    const {
      showPinSetupModal,
      showPinEntryModal,
      isAuthenticated,
      settings
    } = storeToRefs(authStore)

    // Create hiddenAuthState computed for backward compatibility with provide/inject
    const hiddenAuthState = computed(() => ({
      isAuthenticated: isAuthenticated.value
    }))

    // Load settings on mount
    onMounted(async () => {
      await loadSettings()
    })

    const loadSettings = async () => {
      try {
        console.log('[Settings] Loading settings...')
        const data = await authStore.loadSettings()
        console.log('[Settings] Loaded:', data)

        // Check for shared API key in URL
        await processSharedKeyFromUrl(data)
      } catch (error) {
        console.error('[Settings] Error loading settings:', error)
        // Still try to show welcome modal
        const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY)
        if (!dismissed) {
          showWelcomeModal.value = true
        }
      }
    }

    const processSharedKeyFromUrl = async (currentSettings) => {
      // Try route.query first, fall back to URLSearchParams for initial page load
      const urlParams = new URLSearchParams(window.location.search)
      const apiKeyParam = route.query.api_key || urlParams.get('api_key')
      console.log('[SharedKey] Checking for api_key param:', apiKeyParam, '(route.query:', route.query.api_key, ', URL:', urlParams.get('api_key'), ')')

      if (!apiKeyParam) {
        // No shared key in URL - show regular welcome modal if not dismissed
        const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY)
        if (!dismissed) {
          showWelcomeModal.value = true
        }
        return
      }

      // If user already has an API key, ignore the query param
      if (currentSettings.hasApiKey) {
        console.log('[SharedKey] User already has API key, ignoring param')
        // Remove the query param from URL
        const query = { ...route.query }
        delete query.api_key
        router.replace({ path: route.path, query })
        // Still show welcome modal if not dismissed
        const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY)
        if (!dismissed) {
          showWelcomeModal.value = true
        }
        return
      }

      // Validate the shared key
      try {
        console.log('[SharedKey] Validating shared key...')
        const keyInfo = await settingsApi.validateSharedKey(apiKeyParam)
        console.log('[SharedKey] Validation result:', keyInfo)
        if (keyInfo.valid) {
          // Save the shared key as the user's API key
          await settingsApi.update({ apiKey: apiKeyParam })
          console.log('[SharedKey] Saved shared key as API key')

          // Store shared key info to show in welcome modal
          sharedKeyInfo.value = {
            name: keyInfo.name,
            kudos: keyInfo.kudos,
            expiry: keyInfo.expiry
          }
          console.log('[SharedKey] Set sharedKeyInfo:', sharedKeyInfo.value)

          // Show the welcome modal with shared key info
          showWelcomeModal.value = true

          // Remove the query param from URL
          const query = { ...route.query }
          delete query.api_key
          router.replace({ path: route.path, query })
        }
      } catch (error) {
        console.error('[SharedKey] Error validating shared key:', error)
        alert('The shared API key link is invalid or expired.')
        // Remove the invalid query param from URL
        const query = { ...route.query }
        delete query.api_key
        router.replace({ path: route.path, query })
        // Still show welcome modal if not dismissed
        const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY)
        if (!dismissed) {
          showWelcomeModal.value = true
        }
      }
    }

    // Auth functions - delegate to store
    const checkHiddenAuth = () => authStore.checkHiddenAuth()
    const requestHiddenAccess = (callback) => authStore.requestHiddenAccess(callback)
    const handlePinSetupComplete = (data) => authStore.handlePinSetupComplete(data)
    const handlePinVerified = () => authStore.handlePinVerified()
    const handlePinEntryCancel = () => authStore.handlePinEntryCancel()
    const clearHiddenAuth = () => authStore.clearAuth()

    const handleCloseRequestModal = () => {
      showRequestModal.value = false
      // Clear the initial settings when modal closes
      modalInitialSettings.value = null
      modalIncludeSeed.value = false
      modalInitialAlbumSlug.value = null
    }

    const handleNewRequest = () => {
      handleCloseRequestModal()
      // Signal to open the requests panel
      shouldOpenRequestsPanel.value = true
    }

    const openRequestModal = () => {
      showRequestModal.value = true
    }

    const loadSettingsFromImage = async (image, includeSeed = false, albumSlug = null) => {
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

        // Auto-select album if user is currently viewing one
        modalInitialAlbumSlug.value = albumSlug
        console.log('[App] loadSettingsFromImage - albumSlug:', modalInitialAlbumSlug.value)

        // Set the initial settings and show the modal
        modalInitialSettings.value = settings
        modalIncludeSeed.value = includeSeed
        showRequestModal.value = true
      } catch (error) {
        console.error('Error loading settings from image:', error)
      }
    }

    // Provide functions to child components (non-auth functions only - auth is now in authStore)
    provide('loadSettingsFromImage', loadSettingsFromImage)
    provide('openRequestModal', openRequestModal)
    provide('shouldOpenRequestsPanel', shouldOpenRequestsPanel)

    // Demo mode - provide to sidebar
    const openDemoStorageModal = () => {
      showStorageInfo.value = true
    }
    provide('isDemoMode', isDemoMode)
    provide('openDemoStorageModal', openDemoStorageModal)

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
      modalInitialAlbumSlug,
      handleCloseRequestModal,
      handleNewRequest,
      loadSettingsFromImage,
      showPinSetupModal,
      showPinEntryModal,
      handlePinSetupComplete,
      handlePinVerified,
      handlePinEntryCancel,
      showWelcomeModal,
      handleWelcomeModalClose,
      sharedKeyInfo
    }
  }
}
</script>

<style>
.app {
  min-height: 100vh;
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
