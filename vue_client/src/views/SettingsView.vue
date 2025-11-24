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
        <div class="section">
          <h2>AI Horde API Key</h2>
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

        <div class="section" v-if="settings.hasApiKey || userInfo">
          <h2>Account Information</h2>

          <div v-if="loadingUserInfo" class="loading">Loading account info...</div>

          <div v-else-if="userInfo" class="account-info-expanded">
            <!-- Basic Info -->
            <div class="info-group">
              <h3 class="info-group-title">Profile</h3>
              <div class="info-row">
                <span class="label">Username:</span>
                <span class="value">{{ userInfo.username }}</span>
              </div>
              <div class="info-row" v-if="userInfo.account_age">
                <span class="label">Account Age:</span>
                <span class="value">{{ Math.floor(userInfo.account_age / 86400) }} days</span>
              </div>
              <div class="info-row">
                <span class="label">Status:</span>
                <div class="status-badges">
                  <span class="badge badge-trusted" v-if="userInfo.trusted">Trusted</span>
                  <span class="badge badge-moderator" v-if="userInfo.moderator">Moderator</span>
                  <span class="badge badge-customizer" v-if="userInfo.customizer">Customizer</span>
                  <span class="badge badge-service" v-if="userInfo.service">Service Account</span>
                  <span class="badge badge-education" v-if="userInfo.education">Education</span>
                  <span class="badge badge-special" v-if="userInfo.special">Special</span>
                </div>
              </div>
            </div>

            <!-- Kudos Information -->
            <div class="info-group">
              <h3 class="info-group-title">Kudos</h3>
              <div class="info-row">
                <span class="label">Total Kudos:</span>
                <span class="value kudos">{{ userInfo.kudos?.toLocaleString() || 0 }}</span>
              </div>
              <div v-if="userInfo.kudos_details" class="info-subgroup">
                <div class="info-row info-row-small">
                  <span class="label">Accumulated:</span>
                  <span class="value">{{ userInfo.kudos_details.accumulated?.toLocaleString() || 0 }}</span>
                </div>
                <div class="info-row info-row-small">
                  <span class="label">Received:</span>
                  <span class="value">{{ userInfo.kudos_details.received?.toLocaleString() || 0 }}</span>
                </div>
                <div class="info-row info-row-small" v-if="userInfo.kudos_details.gifted">
                  <span class="label">Gifted:</span>
                  <span class="value">{{ userInfo.kudos_details.gifted?.toLocaleString() || 0 }}</span>
                </div>
                <div class="info-row info-row-small" v-if="userInfo.kudos_details.donated">
                  <span class="label">Donated:</span>
                  <span class="value">{{ userInfo.kudos_details.donated?.toLocaleString() || 0 }}</span>
                </div>
              </div>
            </div>

            <!-- Usage Stats -->
            <div class="info-group">
              <h3 class="info-group-title">Usage</h3>
              <div class="info-row">
                <span class="label">Image Requests:</span>
                <span class="value">{{ userInfo.records?.request?.image?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row" v-if="userInfo.records?.request?.text">
                <span class="label">Text Requests:</span>
                <span class="value">{{ userInfo.records.request.text?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row">
                <span class="label">Megapixelsteps:</span>
                <span class="value">{{ userInfo.records?.usage?.megapixelsteps?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row" v-if="userInfo.records?.usage?.tokens">
                <span class="label">Tokens:</span>
                <span class="value">{{ userInfo.records.usage.tokens?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row" v-if="userInfo.concurrency">
                <span class="label">Concurrency:</span>
                <span class="value">{{ userInfo.concurrency }}</span>
              </div>
            </div>

            <!-- Contribution Stats -->
            <div class="info-group" v-if="userInfo.records?.contribution">
              <h3 class="info-group-title">Contributions</h3>
              <div class="info-row">
                <span class="label">Image Fulfillments:</span>
                <span class="value">{{ userInfo.records.fulfillment?.image?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row" v-if="userInfo.records?.fulfillment?.text">
                <span class="label">Text Fulfillments:</span>
                <span class="value">{{ userInfo.records.fulfillment.text?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row">
                <span class="label">Megapixelsteps:</span>
                <span class="value">{{ userInfo.records.contribution?.megapixelsteps?.toLocaleString() || 0 }}</span>
              </div>
              <div class="info-row" v-if="userInfo.records?.contribution?.tokens">
                <span class="label">Tokens:</span>
                <span class="value">{{ userInfo.records.contribution.tokens?.toLocaleString() || 0 }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="userInfoError" class="error-message">
            {{ userInfoError }}
          </div>

          <button @click="refreshUserInfo" class="btn btn-secondary" :disabled="loadingUserInfo">
            {{ loadingUserInfo ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <!-- Workers Section -->
        <div class="section" v-if="settings.hasApiKey && userInfo && userInfo.worker_count > 0">
          <h2>Workers</h2>
          <p class="help-text">
            You have {{ userInfo.worker_count }} worker{{ userInfo.worker_count > 1 ? 's' : '' }} registered.
          </p>
          <button @click="goToWorkers" class="btn btn-primary">
            <i class="fa-solid fa-server"></i> Manage Workers
          </button>
        </div>

        <!-- Shared Keys Section -->
        <div class="section" v-if="settings.hasApiKey && userInfo">
          <h2>Shared Keys</h2>
          <p class="help-text">
            Shared keys allow you to share a limited amount of kudos with others.
          </p>

          <div v-if="loadingSharedKeys" class="loading">Loading shared keys...</div>

          <div v-else-if="sharedKeys.length > 0" class="shared-keys-list">
            <div v-for="key in sharedKeys" :key="key.id" class="shared-key-card">
              <div class="shared-key-header">
                <div class="shared-key-name">{{ key.name || 'Unnamed Key' }}</div>
                <div class="shared-key-actions">
                  <button @click="copySharedKey(key.id)" class="btn-icon" title="Copy Key">
                    <i class="fa-solid fa-copy"></i>
                  </button>
                  <button @click="copyShareUrl(key.id)" class="btn-icon" title="Copy Share URL">
                    <i class="fa-solid fa-link"></i>
                  </button>
                  <button @click="editSharedKey(key)" class="btn-icon" title="Edit">
                    <i class="fa-solid fa-edit"></i>
                  </button>
                  <button @click="deleteSharedKey(key.id)" class="btn-icon btn-icon-danger" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="shared-key-id">ID: {{ key.id }}</div>
              <div class="shared-key-stats">
                <div class="stat-item">
                  <span class="stat-label">Kudos:</span>
                  <span class="stat-value">{{ key.kudos === -1 ? 'Unlimited' : (key.kudos?.toLocaleString() || 0) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Utilized:</span>
                  <span class="stat-value">{{ key.utilized?.toLocaleString() || 0 }}</span>
                </div>
                <div class="stat-item" v-if="key.kudos > 0">
                  <span class="stat-label">Remaining:</span>
                  <span class="stat-value">{{ Math.max(0, (key.kudos - key.utilized)).toLocaleString() }}</span>
                </div>
              </div>
              <div class="usage-bar" v-if="key.kudos > 0 && key.kudos !== -1">
                <div class="usage-fill" :style="{ width: Math.min(100, (key.utilized / key.kudos * 100)) + '%' }"></div>
              </div>
              <div class="shared-key-limits" v-if="key.max_image_pixels || key.max_image_steps || key.max_text_tokens">
                <div class="limit-item" v-if="key.max_image_pixels">
                  <span class="limit-label">Max Pixels:</span>
                  <span class="limit-value">{{ key.max_image_pixels === -1 ? 'Unlimited' : key.max_image_pixels.toLocaleString() }}</span>
                </div>
                <div class="limit-item" v-if="key.max_image_steps">
                  <span class="limit-label">Max Steps:</span>
                  <span class="limit-value">{{ key.max_image_steps === -1 ? 'Unlimited' : key.max_image_steps }}</span>
                </div>
                <div class="limit-item" v-if="key.max_text_tokens">
                  <span class="limit-label">Max Tokens:</span>
                  <span class="limit-value">{{ key.max_text_tokens === -1 ? 'Unlimited' : key.max_text_tokens }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="sharedKeysError" class="error-message">
            {{ sharedKeysError }}
          </div>

          <div v-else class="no-keys-message">
            No shared keys created yet.
          </div>

          <button @click="createNewSharedKey" class="btn btn-primary" style="margin-top: 1rem;">
            <i class="fa-solid fa-plus"></i> Create Shared Key
          </button>
        </div>

        <div class="section">
          <h2>AI Horde Preferences</h2>
          <p class="help-text">
            These settings control which workers can process your image generation requests and how they handle your prompts.
          </p>

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
          <p class="help-text">
            Customize the app's appearance.
          </p>

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
          <p class="help-text">
            Protect your hidden images with a 4-digit PIN.
          </p>

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

    <!-- Shared Key Modal -->
    <div v-if="sharedKeyModalOpen" class="modal-overlay" @click.self="sharedKeyModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editingKey ? 'Edit Shared Key' : 'Create Shared Key' }}</h2>
          <button class="btn-close" @click="sharedKeyModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group-vertical">
            <label>Name</label>
            <input
              type="text"
              v-model="keyForm.name"
              placeholder="Enter key name..."
              class="input-field"
            />
          </div>
          <div class="form-group-vertical">
            <label>Kudos Amount</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="keyForm.unlimited_kudos" @change="handleUnlimitedChange('kudos')" />
                <span>Unlimited</span>
              </label>
            </div>
            <input
              v-if="!keyForm.unlimited_kudos"
              type="number"
              v-model.number="keyForm.kudos"
              placeholder="Enter kudos amount..."
              class="input-field"
              min="0"
            />
          </div>
          <div class="form-group-vertical">
            <label>Max Image Pixels</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="keyForm.unlimited_pixels" @change="handleUnlimitedChange('pixels')" />
                <span>Unlimited</span>
              </label>
            </div>
            <input
              v-if="!keyForm.unlimited_pixels"
              type="number"
              v-model.number="keyForm.max_image_pixels"
              placeholder="e.g., 4194304"
              class="input-field"
              min="0"
            />
          </div>
          <div class="form-group-vertical">
            <label>Max Image Steps</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="keyForm.unlimited_steps" @change="handleUnlimitedChange('steps')" />
                <span>Unlimited</span>
              </label>
            </div>
            <input
              v-if="!keyForm.unlimited_steps"
              type="number"
              v-model.number="keyForm.max_image_steps"
              placeholder="e.g., 100"
              class="input-field"
              min="0"
            />
          </div>
          <div class="form-group-vertical">
            <label>Max Text Tokens</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="keyForm.unlimited_tokens" @change="handleUnlimitedChange('tokens')" />
                <span>Unlimited</span>
              </label>
            </div>
            <input
              v-if="!keyForm.unlimited_tokens"
              type="number"
              v-model.number="keyForm.max_text_tokens"
              placeholder="e.g., 4096"
              class="input-field"
              min="0"
            />
          </div>
          <p v-if="keyFormError" class="error-message">{{ keyFormError }}</p>
          <div class="modal-actions">
            <button @click="sharedKeyModalOpen = false" class="btn btn-secondary">Cancel</button>
            <button @click="saveSharedKey" class="btn btn-primary" :disabled="savingKey">
              {{ savingKey ? 'Saving...' : (editingKey ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { settingsApi } from '../api/client.js'
import { useSettingsStore } from '../stores/settingsStore.js'
import { useTheme } from '../composables/useTheme.js'
import PinInput from '../components/PinInput.vue'

export default {
  name: 'SettingsView',
  components: { PinInput },
  setup() {
    const router = useRouter()
    const settingsStore = useSettingsStore()
    const { currentTheme, toggleTheme } = useTheme()
    const settings = ref({})
    const apiKey = ref('')
    const saving = ref(false)
    const userInfo = ref(null)
    const loadingUserInfo = ref(false)
    const userInfoError = ref(null)
    const savingPrefs = ref(false)

    // Shared keys state
    const sharedKeys = ref([])
    const loadingSharedKeys = ref(false)
    const sharedKeysError = ref(null)
    const sharedKeyModalOpen = ref(false)
    const editingKey = ref(null)
    const keyForm = ref({
      name: '',
      kudos: 0,
      unlimited_kudos: true,
      max_image_pixels: null,
      max_image_steps: null,
      max_text_tokens: null,
      unlimited_pixels: true,
      unlimited_steps: true,
      unlimited_tokens: true
    })
    const keyFormError = ref('')
    const savingKey = ref(false)

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
          loadSharedKeys()
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

    const loadSharedKeys = async () => {
      try {
        loadingSharedKeys.value = true
        sharedKeysError.value = null
        const response = await settingsApi.getHordeSharedKeys()
        sharedKeys.value = response
      } catch (error) {
        console.error('Error loading shared keys:', error)
        sharedKeysError.value = 'Failed to load shared keys'
      } finally {
        loadingSharedKeys.value = false
      }
    }

    const goToWorkers = () => {
      router.push('/settings/workers')
    }

    const createNewSharedKey = () => {
      editingKey.value = null
      keyForm.value = {
        name: '',
        kudos: 0,
        unlimited_kudos: true,
        max_image_pixels: null,
        max_image_steps: null,
        max_text_tokens: null,
        unlimited_pixels: true,
        unlimited_steps: true,
        unlimited_tokens: true
      }
      keyFormError.value = ''
      sharedKeyModalOpen.value = true
    }

    const editSharedKey = (key) => {
      editingKey.value = key
      keyForm.value = {
        name: key.name || '',
        kudos: (key.kudos === -1 ? 0 : key.kudos) || 0,
        unlimited_kudos: key.kudos === -1,
        max_image_pixels: (key.max_image_pixels === -1 ? null : key.max_image_pixels) || null,
        max_image_steps: (key.max_image_steps === -1 ? null : key.max_image_steps) || null,
        max_text_tokens: (key.max_text_tokens === -1 ? null : key.max_text_tokens) || null,
        unlimited_pixels: key.max_image_pixels === -1 || !key.max_image_pixels,
        unlimited_steps: key.max_image_steps === -1 || !key.max_image_steps,
        unlimited_tokens: key.max_text_tokens === -1 || !key.max_text_tokens
      }
      keyFormError.value = ''
      sharedKeyModalOpen.value = true
    }

    const handleUnlimitedChange = (type) => {
      // When checking unlimited, clear the numeric value
      if (type === 'kudos' && keyForm.value.unlimited_kudos) {
        keyForm.value.kudos = 0
      }
      if (type === 'pixels' && keyForm.value.unlimited_pixels) {
        keyForm.value.max_image_pixels = null
      }
      if (type === 'steps' && keyForm.value.unlimited_steps) {
        keyForm.value.max_image_steps = null
      }
      if (type === 'tokens' && keyForm.value.unlimited_tokens) {
        keyForm.value.max_text_tokens = null
      }
    }

    const saveSharedKey = async () => {
      try {
        if (!keyForm.value.name) {
          keyFormError.value = 'Please enter a name for the key'
          return
        }
        if (!keyForm.value.unlimited_kudos && keyForm.value.kudos <= 0) {
          keyFormError.value = 'Kudos amount must be greater than 0 or unlimited'
          return
        }

        savingKey.value = true
        keyFormError.value = ''

        const data = {
          name: keyForm.value.name,
          kudos: keyForm.value.unlimited_kudos ? -1 : keyForm.value.kudos
        }

        // Handle unlimited (-1) values
        if (keyForm.value.unlimited_pixels) {
          data.max_image_pixels = -1
        } else if (keyForm.value.max_image_pixels) {
          data.max_image_pixels = keyForm.value.max_image_pixels
        }

        if (keyForm.value.unlimited_steps) {
          data.max_image_steps = -1
        } else if (keyForm.value.max_image_steps) {
          data.max_image_steps = keyForm.value.max_image_steps
        }

        if (keyForm.value.unlimited_tokens) {
          data.max_text_tokens = -1
        } else if (keyForm.value.max_text_tokens) {
          data.max_text_tokens = keyForm.value.max_text_tokens
        }

        if (editingKey.value) {
          await settingsApi.updateHordeSharedKey(editingKey.value.id, data)
          alert('Shared key updated successfully!')
        } else {
          await settingsApi.createHordeSharedKey(data)
          alert('Shared key created successfully!')
        }

        sharedKeyModalOpen.value = false
        await loadUserInfo()
        await loadSharedKeys()
      } catch (error) {
        console.error('Error saving shared key:', error)
        keyFormError.value = error.response?.data?.error || 'Failed to save shared key'
      } finally {
        savingKey.value = false
      }
    }

    const deleteSharedKey = async (keyId) => {
      if (!confirm('Are you sure you want to delete this shared key? This action cannot be undone.')) {
        return
      }

      try {
        await settingsApi.deleteHordeSharedKey(keyId)
        alert('Shared key deleted successfully!')
        await loadUserInfo()
        await loadSharedKeys()
      } catch (error) {
        console.error('Error deleting shared key:', error)
        alert('Failed to delete shared key. Please try again.')
      }
    }

    const copySharedKey = (keyId) => {
      navigator.clipboard.writeText(keyId).then(() => {
        alert('Key ID copied to clipboard!')
      }).catch(error => {
        console.error('Error copying to clipboard:', error)
        alert('Failed to copy to clipboard')
      })
    }

    const copyShareUrl = (keyId) => {
      const url = `https://artbot.site/?api_key=${keyId}`
      navigator.clipboard.writeText(url).then(() => {
        alert('Share URL copied to clipboard!')
      }).catch(error => {
        console.error('Error copying to clipboard:', error)
        alert('Failed to copy to clipboard')
      })
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
      savingPrefs,
      saveApiKey,
      refreshUserInfo,
      saveWorkerPrefs,
      goBack,
      // Shared keys
      sharedKeys,
      loadingSharedKeys,
      sharedKeysError,
      sharedKeyModalOpen,
      editingKey,
      keyForm,
      keyFormError,
      savingKey,
      createNewSharedKey,
      editSharedKey,
      handleUnlimitedChange,
      saveSharedKey,
      deleteSharedKey,
      copySharedKey,
      copyShareUrl,
      // Workers
      goToWorkers,
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
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #333;
}

.settings-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}

.btn-back {
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid #333;
  border-radius: 6px;
  font-size: 1rem;
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
  gap: 1.5rem;
}

.section {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 2rem;
  border: 1px solid #333;
}

.section h2 {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  color: var(--color-text-primary);
  font-weight: 600;
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
  margin: 0 0 1.5rem 0;
  font-size: 0.95rem;
  color: var(--color-text-tertiary);
  line-height: 1.6;
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
  padding: 1.5rem;
  text-align: center;
  color: var(--color-text-tertiary);
}

.account-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
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
  font-size: 0.95rem;
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

.preferences-grid {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
}

.preference-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
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
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  color: var(--color-text-primary);
  font-size: 1rem;
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
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-group {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 1rem;
}

.info-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-group-title {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-subgroup {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
}

.info-row-small {
  padding: 0.375rem 0;
  font-size: 0.9rem;
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

/* Shared Keys Styles */
.shared-keys-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.shared-key-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.shared-key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.shared-key-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.shared-key-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-tertiary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-text-primary);
}

.btn-icon-danger:hover {
  background: rgba(255, 59, 48, 0.2);
  color: var(--color-danger-ios);
}

.shared-key-id {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin-bottom: 0.75rem;
}

.shared-key-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.usage-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.usage-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}

.shared-key-limits {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.limit-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.limit-label {
  color: var(--color-text-tertiary);
}

.limit-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.no-keys-message {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-tertiary);
}

/* Form Styles for Modal */
.form-group-vertical {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-group-vertical label {
  font-weight: 500;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

.input-field {
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-family: inherit;
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.checkbox-group {
  margin-bottom: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--color-text-primary);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.checkbox-label span {
  user-select: none;
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
    font-size: 1.5rem;
  }

  .section {
    padding: 1.5rem;
  }

  .form-group {
    flex-direction: column;
  }
}
</style>
