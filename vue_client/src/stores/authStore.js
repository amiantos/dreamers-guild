import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsApi } from '@api'

/**
 * Auth Store - Centralized state for hidden content authentication
 * Replaces provide/inject pattern from App.vue
 */
export const useAuthStore = defineStore('auth', () => {
  // State
  const settings = ref({})
  const settingsLoaded = ref(false)
  const isAuthenticated = ref(false)
  const pendingCallback = ref(null)

  // Modal visibility (managed here for centralized control)
  const showPinSetupModal = ref(false)
  const showPinEntryModal = ref(false)

  // Computed
  const hasPinProtection = computed(() => settings.value.hasPinProtection || false)
  const pinEnabled = computed(() => settings.value.hidden_pin_enabled)

  /**
   * Load settings from API
   */
  const loadSettings = async () => {
    try {
      const data = await settingsApi.get()
      settings.value = data
      settingsLoaded.value = true
      return data
    } catch (error) {
      console.error('[AuthStore] Error loading settings:', error)
      settingsLoaded.value = true // Mark as loaded even on error
      throw error
    }
  }

  /**
   * Check if user has access to hidden content
   * Returns true if authenticated or PIN protection is disabled
   */
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
    return isAuthenticated.value
  }

  /**
   * Request access to hidden content
   * Shows appropriate modal (setup or entry) and executes callback on success
   */
  const requestHiddenAccess = (callback) => {
    // Wait for settings to load
    if (!settingsLoaded.value) {
      setTimeout(() => requestHiddenAccess(callback), 100)
      return
    }

    // Check if PIN is configured
    if (settings.value.hidden_pin_enabled === null || settings.value.hidden_pin_enabled === undefined) {
      // Not configured - show setup modal
      showPinSetupModal.value = true
      pendingCallback.value = callback
      return
    }

    // Check if already authenticated
    if (checkHiddenAuth()) {
      callback()
      return
    }

    // Need to verify PIN
    showPinEntryModal.value = true
    pendingCallback.value = callback
  }

  /**
   * Handle successful PIN setup
   */
  const handlePinSetupComplete = async ({ hasPin }) => {
    await loadSettings()
    isAuthenticated.value = hasPin
    showPinSetupModal.value = false

    // Execute pending callback
    if (pendingCallback.value) {
      pendingCallback.value()
      pendingCallback.value = null
    }
  }

  /**
   * Handle successful PIN verification
   */
  const handlePinVerified = () => {
    isAuthenticated.value = true
    showPinEntryModal.value = false

    // Execute pending callback
    if (pendingCallback.value) {
      pendingCallback.value()
      pendingCallback.value = null
    }
  }

  /**
   * Handle PIN entry cancellation
   */
  const handlePinEntryCancel = () => {
    showPinEntryModal.value = false
    pendingCallback.value = null
  }

  /**
   * Clear authentication (logout from hidden content)
   */
  const clearAuth = () => {
    isAuthenticated.value = false
  }

  /**
   * Close PIN setup modal without completing setup
   */
  const closePinSetupModal = () => {
    showPinSetupModal.value = false
    pendingCallback.value = null
  }

  return {
    // State
    settings,
    settingsLoaded,
    isAuthenticated,
    showPinSetupModal,
    showPinEntryModal,

    // Computed
    hasPinProtection,
    pinEnabled,

    // Actions
    loadSettings,
    checkHiddenAuth,
    requestHiddenAccess,
    handlePinSetupComplete,
    handlePinVerified,
    handlePinEntryCancel,
    clearAuth,
    closePinSetupModal
  }
})
