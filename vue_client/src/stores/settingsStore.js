import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsApi } from '@api'

/**
 * Settings Store - Centralized state management for user settings
 * Handles both last used settings (form state) and worker preferences
 * with localStorage caching and server synchronization
 */
export const useSettingsStore = defineStore('settings', () => {
  // Last used settings for the request form
  const lastUsedSettings = ref({
    prompt: '',
    negativePrompt: '',
    model: '',
    n: 1,
    steps: 30,
    width: 512,
    height: 512,
    cfgScale: 7,
    clipSkip: 1,
    sampler: 'k_euler_a',
    seed: '',
    useRandomSeed: true,
    karras: true,
    hiresFix: false,
    tiling: false,
    postProcessing: []
  })

  // AI Horde preferences (renamed from worker preferences)
  const workerPreferences = ref({
    slowWorkers: true,
    trustedWorkers: false,
    nsfw: false,
    allowDowngrade: true,
    replacementFilter: true
  })

  // Loading states
  const loadingLastUsed = ref(false)
  const loadingWorkerPrefs = ref(false)

  /**
   * Load last used settings from cache or server
   * Tries localStorage first for instant loading, falls back to server
   * @returns {Promise<Object>} The loaded settings
   */
  const loadLastUsedSettings = async () => {
    try {
      loadingLastUsed.value = true

      // Try localStorage first for instant loading
      const cachedSettings = localStorage.getItem('lastUsedSettings')
      if (cachedSettings) {
        try {
          const settings = JSON.parse(cachedSettings)
          if (settings && typeof settings === 'object') {
            lastUsedSettings.value = { ...lastUsedSettings.value, ...settings }
            return lastUsedSettings.value
          }
        } catch (parseError) {
          console.error('Error parsing cached settings:', parseError)
          // Fall through to server fetch
        }
      }

      // Fallback to server if no cache or cache failed
      const response = await settingsApi.get()
      if (response.data && response.data.last_used_settings) {
        try {
          const settings = JSON.parse(response.data.last_used_settings)
          if (settings && typeof settings === 'object') {
            lastUsedSettings.value = { ...lastUsedSettings.value, ...settings }
            // Cache the settings locally for next time
            localStorage.setItem('lastUsedSettings', JSON.stringify(settings))
          }
        } catch (parseError) {
          console.error('Error parsing last_used_settings:', parseError)
        }
      }

      return lastUsedSettings.value
    } catch (error) {
      console.error('Error loading last used settings:', error)
      return lastUsedSettings.value
    } finally {
      loadingLastUsed.value = false
    }
  }

  /**
   * Load worker preferences from localStorage
   * @returns {Object} Worker preferences
   */
  const loadWorkerPreferences = () => {
    try {
      loadingWorkerPrefs.value = true
      const savedPrefs = localStorage.getItem('workerPreferences')
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs)
        workerPreferences.value = { ...workerPreferences.value, ...prefs }
      }
      return workerPreferences.value
    } catch (error) {
      console.error('Error loading worker preferences:', error)
      return workerPreferences.value
    } finally {
      loadingWorkerPrefs.value = false
    }
  }

  /**
   * Save worker preferences to localStorage
   * @param {Object} prefs - Worker preferences to save
   */
  const saveWorkerPreferences = (prefs) => {
    try {
      workerPreferences.value = { ...workerPreferences.value, ...prefs }
      localStorage.setItem('workerPreferences', JSON.stringify(workerPreferences.value))
    } catch (error) {
      console.error('Error saving worker preferences:', error)
    }
  }

  /**
   * Update a specific setting value
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  const updateSetting = (key, value) => {
    if (key in lastUsedSettings.value) {
      lastUsedSettings.value[key] = value
    }
  }

  /**
   * Update multiple settings at once
   * @param {Object} settings - Settings object with key-value pairs
   */
  const updateSettings = (settings) => {
    lastUsedSettings.value = { ...lastUsedSettings.value, ...settings }
  }

  /**
   * Reset last used settings to defaults
   */
  const resetLastUsedSettings = () => {
    lastUsedSettings.value = {
      prompt: '',
      negativePrompt: '',
      model: '',
      n: 1,
      steps: 30,
      width: 512,
      height: 512,
      cfgScale: 7,
      clipSkip: 1,
      sampler: 'k_euler_a',
      seed: '',
      useRandomSeed: true,
      karras: true,
      hiresFix: false,
      tiling: false,
      postProcessing: []
    }
    localStorage.removeItem('lastUsedSettings')
  }

  /**
   * Reset worker preferences to defaults
   */
  const resetWorkerPreferences = () => {
    workerPreferences.value = {
      slowWorkers: true,
      trustedWorkers: false,
      nsfw: false,
      allowDowngrade: true,
      replacementFilter: true
    }
    localStorage.removeItem('workerPreferences')
  }

  return {
    // State
    lastUsedSettings,
    workerPreferences,
    loadingLastUsed,
    loadingWorkerPrefs,
    // Actions
    loadLastUsedSettings,
    loadWorkerPreferences,
    saveWorkerPreferences,
    updateSetting,
    updateSettings,
    resetLastUsedSettings,
    resetWorkerPreferences
  }
})
