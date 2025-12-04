<template>
  <div class="settings-view">
    <div class="settings-container">
      <div class="settings-header">
        <h1>Settings</h1>
        <button @click="goBack" class="btn-back">
          <i class="fa-solid fa-arrow-left"></i> Back to Library
        </button>
      </div>

      <div class="settings-content">
        <div class="section" v-if="!settings.hasApiKey">
          <h2>AI Horde API Key</h2>
          <div class="section-content">
            <p class="help-text">
              Enter your AI Horde API key to use your account. Get your key from
              <a href="https://stablehorde.net/" target="_blank" rel="noopener">stablehorde.net</a>
            </p>

            <div class="form-group">
              <input
                type="password"
                v-model="apiKey"
                placeholder="Enter your API key..."
                class="api-key-input"
              />
              <button @click="saveApiKey" class="btn btn-primary" :disabled="saving">
                {{ saving ? 'Saving...' : 'Save API Key' }}
              </button>
            </div>
          </div>
        </div>

        <div class="section" v-if="settings.hasApiKey || userInfo">
          <h2>Account Information</h2>

          <div v-if="loadingUserInfo" class="loading">Loading account info...</div>

          <div v-else-if="userInfo" class="account-info-expanded">
            <!-- Shared Key User Info -->
            <template v-if="isSharedKeyUser && currentSharedKeyInfo">
              <!-- Stats Grid -->
              <div class="info-group stats-section">
                <div class="stats-grid">
                  <div class="stat-card">
                    <span class="stat-value">{{ currentSharedKeyInfo.name }}</span>
                    <span class="stat-label">Key Name</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ currentSharedKeyInfo.username }}</span>
                    <span class="stat-label">Key From</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ currentSharedKeyInfo.kudos === -1 ? 'Unlimited' : (currentSharedKeyInfo.kudos?.toLocaleString() || 0) }}</span>
                    <span class="stat-label">Kudos</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ currentSharedKeyInfo.max_image_pixels === -1 ? 'Unlimited' : (currentSharedKeyInfo.max_image_pixels?.toLocaleString() || 'Unlimited') }}</span>
                    <span class="stat-label">Max Pixels</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ currentSharedKeyInfo.max_image_steps === -1 ? 'Unlimited' : (currentSharedKeyInfo.max_image_steps || 'Unlimited') }}</span>
                    <span class="stat-label">Max Steps</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ currentSharedKeyInfo.expiry ? new Date(currentSharedKeyInfo.expiry).toLocaleDateString() : 'Never' }}</span>
                    <span class="stat-label">Expires</span>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="info-group action-buttons-section">
                <div class="management-buttons">
                  <button @click="refreshUserInfo" class="btn btn-secondary btn-manage" :disabled="loadingUserInfo">
                    {{ loadingUserInfo ? 'Refreshing...' : 'Refresh Info' }}
                  </button>
                  <button @click="showSignOutModal" class="btn btn-secondary btn-manage btn-sign-out">
                    Sign Out
                  </button>
                </div>
              </div>
            </template>

            <!-- Regular User Info -->
            <template v-else>
              <!-- Stats Grid -->
              <div class="info-group stats-section">
                <div class="stats-grid">
                  <div class="stat-card">
                    <span class="stat-value">{{ userInfo.username }}</span>
                    <span class="stat-label">Username</span>
                  </div>
                  <div class="stat-card" v-if="userInfo.account_age">
                    <span class="stat-value">{{ Math.floor(userInfo.account_age / 86400) }}</span>
                    <span class="stat-label">Days Old</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ userInfo.trusted ? 'Yes' : 'No' }}</span>
                    <span class="stat-label">Trusted</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ userInfo.kudos?.toLocaleString() || 0 }}</span>
                    <span class="stat-label">Kudos</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ userInfo.records?.request?.image?.toLocaleString() || 0 }}</span>
                    <span class="stat-label">Images Requested</span>
                  </div>
                  <div class="stat-card" v-if="userInfo.records?.fulfillment?.image">
                    <span class="stat-value">{{ userInfo.records.fulfillment.image?.toLocaleString() || 0 }}</span>
                    <span class="stat-label">Images Fulfilled</span>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="info-group action-buttons-section">
                <div class="management-buttons">
                  <button @click="goToWorkers" class="btn btn-secondary btn-manage" v-if="userInfo.worker_count > 0">
                    <i class="fa-solid fa-server"></i> Manage Workers
                  </button>
                  <button @click="goToSharedKeys" class="btn btn-secondary btn-manage">
                    <i class="fa-solid fa-key"></i> Manage Shared Keys
                  </button>
                </div>
                <div class="management-buttons">
                  <button @click="refreshUserInfo" class="btn btn-secondary btn-manage" :disabled="loadingUserInfo">
                    {{ loadingUserInfo ? 'Refreshing...' : 'Refresh Info' }}
                  </button>
                  <button @click="showSignOutModal" class="btn btn-secondary btn-manage btn-sign-out">
                    Sign Out
                  </button>
                </div>
              </div>
            </template>
          </div>

          <div v-else-if="userInfoError" class="error-message">
            {{ userInfoError }}
          </div>
        </div>

        <div class="section">
          <h2>AI Horde Preferences</h2>
          <div class="preferences-grid">
            <div class="preference-item">
              <div class="preference-label">
                <span class="pref-title">Allow Slow Workers</span>
                <span class="pref-desc">Include workers with slower processing times</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsStore.workerPreferences.slowWorkers" @change="saveWorkerPrefs" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="preference-item">
              <div class="preference-label">
                <span class="pref-title">Trusted Workers Only</span>
                <span class="pref-desc">Only use workers marked as trusted</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsStore.workerPreferences.trustedWorkers" @change="saveWorkerPrefs" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="preference-item">
              <div class="preference-label">
                <span class="pref-title">Allow NSFW</span>
                <span class="pref-desc">Allow generation of NSFW content</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsStore.workerPreferences.nsfw" @change="saveWorkerPrefs" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="preference-item">
              <div class="preference-label">
                <span class="pref-title">Auto Downgrade</span>
                <span class="pref-desc">Allow workers to automatically downgrade your request if needed</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsStore.workerPreferences.allowDowngrade" @change="saveWorkerPrefs" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="preference-item">
              <div class="preference-label">
                <span class="pref-title">Automatic Prompt Filter</span>
                <span class="pref-desc">Automatically filter and replace inappropriate terms in prompts</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsStore.workerPreferences.replacementFilter" @change="saveWorkerPrefs" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div v-if="savingPrefs" class="saving-indicator">Saving...</div>
        </div>

        <div class="section">
          <h2>Appearance</h2>
          <div class="preferences-grid">
            <div class="preference-item">
              <div class="preference-label">
                <span class="pref-title">Theme</span>
                <span class="pref-desc">{{ currentTheme === 'dark' ? 'Dark' : 'Light' }} mode</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" :checked="currentTheme === 'light'" @change="handleThemeToggle" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Hidden Gallery Protection</h2>
          <div v-if="settings.hasPinProtection" class="pin-status">
            <div class="status-indicator">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="#587297" stroke-width="2"/>
                <path d="M6 10l3 3 5-5" stroke="#587297" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>PIN protection is enabled</span>
            </div>
            <div class="pin-actions">
              <button @click="showChangePinModal" class="btn btn-secondary">Change PIN</button>
              <button @click="showRemovePinModal" class="btn btn-danger">Remove PIN</button>
            </div>
          </div>

          <div v-else-if="settings.hidden_pin_enabled === 0" class="pin-status">
            <div class="status-indicator">
              <span>PIN protection is disabled</span>
            </div>
            <button @click="showSetPinModal" class="btn btn-primary">Set PIN</button>
          </div>

          <div v-else class="pin-status">
            <div class="status-indicator">
              <span>PIN not configured</span>
            </div>
            <button @click="showSetPinModal" class="btn btn-primary">Set PIN</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Change PIN Modal -->
    <div v-if="changePinModalOpen" class="modal-overlay" @click.self="changePinModalOpen = false">
      <div class="modal-content pin-modal">
        <div class="modal-header">
          <h2>Change PIN</h2>
          <button class="btn-close" @click="changePinModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="pin-section">
            <label>Current PIN</label>
            <PinInput v-model="currentPin" ref="currentPinInput" @complete="handleCurrentPinComplete" />
          </div>
          <div v-if="currentPinVerified" class="pin-section">
            <label>{{ newPinConfirmMode ? 'Confirm New PIN' : 'New PIN' }}</label>
            <PinInput v-model="newPin" ref="newPinInput" @complete="handleNewPinComplete" />
          </div>
          <p v-if="pinError" class="error-message">{{ pinError }}</p>
        </div>
      </div>
    </div>

    <!-- Remove PIN Modal -->
    <div v-if="removePinModalOpen" class="modal-overlay" @click.self="removePinModalOpen = false">
      <div class="modal-content pin-modal">
        <div class="modal-header">
          <h2>Remove PIN Protection</h2>
          <button class="btn-close" @click="removePinModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <p class="help-text">Enter your PIN to remove protection from the hidden gallery.</p>
          <div class="pin-section">
            <label>Current PIN</label>
            <PinInput v-model="removePinValue" ref="removePinInput" @complete="handleRemovePin" />
          </div>
          <p v-if="pinError" class="error-message">{{ pinError }}</p>
        </div>
      </div>
    </div>

    <!-- Set PIN Modal -->
    <div v-if="setPinModalOpen" class="modal-overlay" @click.self="setPinModalOpen = false">
      <div class="modal-content pin-modal">
        <div class="modal-header">
          <h2>Set PIN</h2>
          <button class="btn-close" @click="setPinModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <p class="help-text">Set a 4-digit PIN to protect your hidden gallery.</p>
          <div class="pin-section">
            <label>{{ setPinConfirmMode ? 'Confirm PIN' : 'Enter PIN' }}</label>
            <PinInput v-model="setPinValue" ref="setPinInput" @complete="handleSetPinComplete" />
          </div>
          <p v-if="pinError" class="error-message">{{ pinError }}</p>
        </div>
      </div>
    </div>

    <!-- Sign Out Confirmation Modal -->
    <BaseModal :show="signOutModalOpen" size="small" @close="signOutModalOpen = false">
      <div class="modal-body sign-out-modal">
        <h2>Delete API Key?</h2>
        <p class="warning-text">
          Be sure you have your API key saved somewhere else before you clear it here, as it may not be recoverable in some circumstances.
        </p>
        <div class="modal-actions">
          <button @click="signOutModalOpen = false" class="btn btn-secondary">Cancel</button>
          <button @click="deleteApiKey" class="btn btn-danger">Delete</button>
        </div>
      </div>
    </BaseModal>

  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { settingsApi } from '@api'
import { useSettingsStore } from '../stores/settingsStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useTheme } from '../composables/useTheme.js'
import PinInput from '../components/PinInput.vue'
import BaseModal from '../components/BaseModal.vue'

export default {
  name: 'SettingsView',
  components: { PinInput, BaseModal },
  setup() {
    const router = useRouter()
    const settingsStore = useSettingsStore()
    const authStore = useAuthStore()
    const clearHiddenAuth = () => authStore.clearAuth()
    const { currentTheme, toggleTheme } = useTheme()
    const settings = ref({})
    const apiKey = ref('')
    const saving = ref(false)
    const userInfo = ref(null)
    const loadingUserInfo = ref(false)
    const userInfoError = ref(null)
    const currentSharedKeyInfo = ref(null)
    const savingPrefs = ref(false)

    // Computed property to check if user is using a shared key
    const isSharedKeyUser = computed(() => {
      return userInfo.value?.username?.includes('Shared Key:')
    })

    // Sign out modal state
    const signOutModalOpen = ref(false)

    // PIN management state
    const changePinModalOpen = ref(false)
    const removePinModalOpen = ref(false)
    const setPinModalOpen = ref(false)
    const currentPin = ref('')
    const newPin = ref('')
    const removePinValue = ref('')
    const setPinValue = ref('')
    const currentPinVerified = ref(false)
    const newPinConfirmMode = ref(false)
    const setPinConfirmMode = ref(false)
    const firstSetPin = ref('')
    const firstNewPin = ref('')
    const pinError = ref('')
    const currentPinInput = ref(null)
    const newPinInput = ref(null)
    const removePinInput = ref(null)
    const setPinInput = ref(null)

    const goBack = () => {
      router.push('/')
    }

    const loadSettings = async () => {
      try {
        // Load worker preferences from store
        settingsStore.loadWorkerPreferences()

        // Load cached user info for instant display
        const cachedUserInfo = localStorage.getItem('userInfo')
        if (cachedUserInfo) {
          try {
            userInfo.value = JSON.parse(cachedUserInfo)
          } catch (error) {
            console.error('Error parsing cached user info:', error)
          }
        }

        // Then load from server
        const response = await settingsApi.get()
        settings.value = response
        if (settings.value.hasApiKey) {
          loadUserInfo()
        }

        // Load worker preferences from server (overrides localStorage if available)
        if (settings.value.worker_preferences) {
          try {
            const prefs = JSON.parse(settings.value.worker_preferences)
            settingsStore.saveWorkerPreferences(prefs)
          } catch (error) {
            console.error('Error parsing worker preferences:', error)
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }

    const saveApiKey = async () => {
      try {
        saving.value = true
        const response = await settingsApi.update({ apiKey: apiKey.value })
        settings.value = response
        apiKey.value = ''
        alert('API key saved successfully!')

        // Load user info after saving key
        if (settings.value.hasApiKey) {
          loadUserInfo()
        }
      } catch (error) {
        console.error('Error saving API key:', error)
        alert('Failed to save API key. Please try again.')
      } finally {
        saving.value = false
      }
    }

    const showSignOutModal = () => {
      signOutModalOpen.value = true
    }

    const deleteApiKey = async () => {
      try {
        await settingsApi.update({ apiKey: '' })
        userInfo.value = null
        localStorage.removeItem('userInfo')

        // Clear account-specific caches
        settingsStore.resetWorkerPreferences()
        if (clearHiddenAuth) {
          clearHiddenAuth()
        }

        signOutModalOpen.value = false
        await loadSettings()
      } catch (error) {
        console.error('Error deleting API key:', error)
        alert('Failed to delete API key. Please try again.')
      }
    }

    const loadUserInfo = async () => {
      try {
        // Only show loading if we don't have cached data
        if (!userInfo.value) {
          loadingUserInfo.value = true
        }
        userInfoError.value = null
        const response = await settingsApi.getHordeUser()
        userInfo.value = response
        // Cache user info to localStorage for instant loading next time
        localStorage.setItem('userInfo', JSON.stringify(response))

        // If this is a shared key user, fetch the shared key details
        if (response?.username?.includes('Shared Key:')) {
          try {
            currentSharedKeyInfo.value = await settingsApi.getCurrentSharedKeyInfo()
          } catch (error) {
            console.error('Error loading shared key info:', error)
          }
        } else {
          currentSharedKeyInfo.value = null
        }
      } catch (error) {
        console.error('Error loading user info:', error)
        userInfoError.value = 'Failed to load account information. Check your API key.'
      } finally {
        loadingUserInfo.value = false
      }
    }

    const refreshUserInfo = () => {
      loadUserInfo()
    }

    const goToWorkers = () => {
      router.push('/settings/workers')
    }

    const goToSharedKeys = () => {
      router.push('/settings/shared-keys')
    }

    const saveWorkerPrefs = async () => {
      try {
        savingPrefs.value = true
        await settingsApi.update({ workerPreferences: settingsStore.workerPreferences })
        // Also update localStorage for immediate access
        settingsStore.saveWorkerPreferences(settingsStore.workerPreferences)
      } catch (error) {
        console.error('Error saving worker preferences:', error)
        alert('Failed to save AI Horde preferences. Please try again.')
      } finally {
        savingPrefs.value = false
      }
    }

    // Theme toggle handler
    const handleThemeToggle = () => {
      toggleTheme()
    }

    // PIN management methods
    const showChangePinModal = () => {
      changePinModalOpen.value = true
      currentPin.value = ''
      newPin.value = ''
      currentPinVerified.value = false
      newPinConfirmMode.value = false
      pinError.value = ''
      nextTick(() => {
        currentPinInput.value?.focus()
      })
    }

    const showRemovePinModal = () => {
      removePinModalOpen.value = true
      removePinValue.value = ''
      pinError.value = ''
      nextTick(() => {
        removePinInput.value?.focus()
      })
    }

    const showSetPinModal = () => {
      setPinModalOpen.value = true
      setPinValue.value = ''
      setPinConfirmMode.value = false
      firstSetPin.value = ''
      pinError.value = ''
      nextTick(() => {
        setPinInput.value?.focus()
      })
    }

    const handleCurrentPinComplete = async (value) => {
      pinError.value = ''
      try {
        const response = await settingsApi.verifyHiddenPin(value)
        if (response.valid) {
          currentPinVerified.value = true
          currentPin.value = value
          nextTick(() => {
            newPinInput.value?.focus()
          })
        } else {
          pinError.value = 'Incorrect PIN'
          currentPin.value = ''
          setTimeout(() => {
            pinError.value = ''
            currentPinInput.value?.focus()
          }, 2000)
        }
      } catch (error) {
        console.error('Error verifying PIN:', error)
        pinError.value = error.response?.data?.error || 'Failed to verify PIN'
        currentPin.value = ''
      }
    }

    const handleNewPinComplete = async (value) => {
      if (!newPinConfirmMode.value) {
        firstNewPin.value = value
        newPinConfirmMode.value = true
        newPin.value = ''
        nextTick(() => {
          newPinInput.value?.focus()
        })
      } else {
        if (value === firstNewPin.value) {
          try {
            await settingsApi.changeHiddenPin(currentPin.value, value)
            changePinModalOpen.value = false
            await loadSettings()
            alert('PIN changed successfully!')
          } catch (error) {
            console.error('Error changing PIN:', error)
            pinError.value = error.response?.data?.error || 'Failed to change PIN'
          }
        } else {
          pinError.value = 'PINs do not match'
          newPinConfirmMode.value = false
          firstNewPin.value = ''
          newPin.value = ''
          setTimeout(() => {
            pinError.value = ''
            newPinInput.value?.focus()
          }, 2000)
        }
      }
    }

    const handleRemovePin = async (value) => {
      pinError.value = ''
      try {
        await settingsApi.removeHiddenPin(value)
        removePinModalOpen.value = false
        await loadSettings()
        alert('PIN protection removed successfully!')
      } catch (error) {
        console.error('Error removing PIN:', error)
        pinError.value = error.response?.data?.error || 'Failed to remove PIN'
        removePinValue.value = ''
        setTimeout(() => {
          pinError.value = ''
          removePinInput.value?.focus()
        }, 2000)
      }
    }

    const handleSetPinComplete = async (value) => {
      if (!setPinConfirmMode.value) {
        firstSetPin.value = value
        setPinConfirmMode.value = true
        setPinValue.value = ''
        nextTick(() => {
          setPinInput.value?.focus()
        })
      } else {
        if (value === firstSetPin.value) {
          try {
            await settingsApi.setupHiddenPin(value, false)
            setPinModalOpen.value = false
            await loadSettings()
            alert('PIN set successfully!')
          } catch (error) {
            console.error('Error setting PIN:', error)
            pinError.value = error.response?.data?.error || 'Failed to set PIN'
          }
        } else {
          pinError.value = 'PINs do not match'
          setPinConfirmMode.value = false
          firstSetPin.value = ''
          setPinValue.value = ''
          setTimeout(() => {
            pinError.value = ''
            setPinInput.value?.focus()
          }, 2000)
        }
      }
    }

    onMounted(() => {
      loadSettings()
    })

    return {
      settingsStore,
      settings,
      apiKey,
      saving,
      userInfo,
      loadingUserInfo,
      userInfoError,
      currentSharedKeyInfo,
      isSharedKeyUser,
      savingPrefs,
      saveApiKey,
      refreshUserInfo,
      saveWorkerPrefs,
      goBack,
      // Sign out
      signOutModalOpen,
      showSignOutModal,
      deleteApiKey,
      // Workers and Shared Keys navigation
      goToWorkers,
      goToSharedKeys,
      // Theme
      currentTheme,
      handleThemeToggle,
      // PIN management
      changePinModalOpen,
      removePinModalOpen,
      setPinModalOpen,
      currentPin,
      newPin,
      removePinValue,
      setPinValue,
      currentPinVerified,
      newPinConfirmMode,
      setPinConfirmMode,
      pinError,
      currentPinInput,
      newPinInput,
      removePinInput,
      setPinInput,
      showChangePinModal,
      showRemovePinModal,
      showSetPinModal,
      handleCurrentPinComplete,
      handleNewPinComplete,
      handleRemovePin,
      handleSetPinComplete
    }
  }
}
</script>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.settings-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 1.5rem;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #333;
}

.settings-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid #333;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-back:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.section {
  margin-bottom: 1.5rem;
}

.section h2 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.05em;
}

.section-title {
  margin: 1.5rem 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.05em;
}

.help-text {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  color: var(--color-text-tertiary);
  line-height: 1.5;
}

.help-text a {
  color: var(--color-primary);
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

.form-group {
  display: flex;
  gap: 0.75rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
}

.api-key-input {
  flex: 1;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-family: monospace;
}

.api-key-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid #333;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-tertiary);
}

.account-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

.info-row .value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.info-row .value.kudos {
  color: var(--color-primary);
  font-weight: 600;
}

.error-message {
  padding: 1rem;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 6px;
  color: var(--color-danger-ios);
  margin-bottom: 1rem;
}

.section-content {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.section-content .help-text {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.section-content .help-text:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.preferences-grid {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.preferences-grid .help-text {
  margin-bottom: 0;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pin-status .help-text {
  margin-bottom: 0;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.preference-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.preference-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.preference-label {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
}

.pref-title {
  color: var(--color-text-primary);
  font-weight: 500;
  font-size: 1rem;
}

.pref-desc {
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Toggle Switch Styling */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 51px;
  height: 31px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #39393d;
  transition: 0.3s;
  border-radius: 31px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 27px;
  width: 27px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.saving-indicator {
  text-align: center;
  padding: 0.75rem;
  color: var(--color-primary);
  font-size: 0.95rem;
  margin-top: 1rem;
}

.pin-status {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  color: var(--color-text-primary);
  font-size: 0.95rem;
}

.status-indicator svg {
  flex-shrink: 0;
}

.pin-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-danger {
  background: var(--color-danger-ios);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

/* Modal styles for PIN modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-darkest);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: var(--color-surface);
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--color-text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.pin-modal {
  max-width: 450px;
}

.pin-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin: 1.5rem 0;
}

.pin-section label {
  font-weight: 500;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

/* Account Info Expanded Styles */
.account-info-expanded {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-group {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-group-title {
  display: block;
  margin-bottom: 0.5rem;
}

.info-subgroup {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
}

.info-row-small {
  padding: 0.375rem 0;
  font-size: 0.9rem;
}

/* Stats Grid */
.stats-section {
  border-bottom: none;
  padding-bottom: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 0.75rem;
  text-align: center;
  min-width: 0;
}

.stat-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-label {
  display: block;
  font-size: 0.7rem;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Action Buttons Section */
.action-buttons-section {
  border-bottom: none;
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge-trusted {
  background: rgba(52, 199, 89, 0.2);
  color: #34c759;
}

.badge-moderator {
  background: rgba(255, 149, 0, 0.2);
  color: #ff9500;
}

.badge-customizer {
  background: rgba(255, 204, 0, 0.2);
  color: #ffcc00;
}

.badge-service {
  background: rgba(88, 114, 151, 0.2);
  color: #587297;
}

.badge-education {
  background: rgba(90, 200, 250, 0.2);
  color: #5ac8fa;
}

.badge-special {
  background: rgba(175, 82, 222, 0.2);
  color: #af52de;
}

/* Management Buttons */
.management-buttons {
  display: flex;
  gap: 1rem;
}

.btn-manage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

/* Account actions */
.account-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.btn-sign-out {
  color: var(--color-danger-ios);
}

/* Sign out modal */
.sign-out-modal {
  padding: 1.5rem;
  text-align: center;
}

.sign-out-modal h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: var(--color-text-primary);
}

.warning-text {
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.sign-out-modal .modal-actions {
  justify-content: center;
}

@media (max-width: 768px) {
  .settings-container {
    padding: 1rem;
  }

  .settings-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .settings-header h1 {
    font-size: 1.25rem;
  }

  .form-group {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .management-buttons {
    flex-direction: column;
  }
}
</style>
