<template>
  <div class="app">
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
import { ref, provide, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import RequestGeneratorModal from './components/RequestGeneratorModal.vue'
import PinSetupModal from './components/PinSetupModal.vue'
import PinEntryModal from './components/PinEntryModal.vue'
import { settingsApi } from './api/client.js'

export default {
  name: 'App',
  components: {
    RequestGeneratorModal,
    PinSetupModal,
    PinEntryModal
  },
  setup() {
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
      isAuthenticated: false,
      lastAuthTime: null
    })
    const pendingHiddenAccess = ref(null) // Callback to run after successful PIN entry
    const AUTH_TIMEOUT = 5 * 60 * 1000 // 5 minutes in milliseconds

    // Load settings on mount
    onMounted(async () => {
      await loadSettings()
      setupActivityTracking()
    })

    // Clean up activity listeners on unmount
    onUnmounted(() => {
      cleanupActivityTracking()
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

    // Activity tracking for 5-minute timeout
    let activityTimeout = null
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']

    const resetAuthTimeout = () => {
      if (hiddenAuthState.value.isAuthenticated) {
        hiddenAuthState.value.lastAuthTime = Date.now()

        if (activityTimeout) {
          clearTimeout(activityTimeout)
        }

        activityTimeout = setTimeout(() => {
          hiddenAuthState.value.isAuthenticated = false
          hiddenAuthState.value.lastAuthTime = null
        }, AUTH_TIMEOUT)
      }
    }

    const setupActivityTracking = () => {
      activityEvents.forEach(event => {
        window.addEventListener(event, resetAuthTimeout, { passive: true })
      })
    }

    const cleanupActivityTracking = () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetAuthTimeout)
      })
      if (activityTimeout) {
        clearTimeout(activityTimeout)
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

      // Check if authenticated and within timeout
      if (hiddenAuthState.value.isAuthenticated && hiddenAuthState.value.lastAuthTime) {
        const timeSinceAuth = Date.now() - hiddenAuthState.value.lastAuthTime
        if (timeSinceAuth < AUTH_TIMEOUT) {
          return true
        }
      }

      return false
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
      hiddenAuthState.value.lastAuthTime = hasPin ? Date.now() : null

      if (hasPin) {
        resetAuthTimeout()
      }

      // Execute pending callback
      if (pendingHiddenAccess.value) {
        pendingHiddenAccess.value()
        pendingHiddenAccess.value = null
      }
    }

    const handlePinVerified = () => {
      hiddenAuthState.value.isAuthenticated = true
      hiddenAuthState.value.lastAuthTime = Date.now()
      resetAuthTimeout()

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

    return {
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
</style>
