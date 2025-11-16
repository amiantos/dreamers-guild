<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="section">
          <h3>AI Horde API Key</h3>
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

        <div class="section" v-if="settings.hasApiKey">
          <h3>Account Information</h3>

          <div v-if="loadingUserInfo" class="loading">Loading account info...</div>

          <div v-else-if="userInfo" class="account-info">
            <div class="info-row">
              <span class="label">Username:</span>
              <span class="value">{{ userInfo.username }}</span>
            </div>
            <div class="info-row">
              <span class="label">Kudos:</span>
              <span class="value kudos">{{ userInfo.kudos?.toLocaleString() || 0 }}</span>
            </div>
            <div class="info-row">
              <span class="label">Images Generated:</span>
              <span class="value">{{ userInfo.usage?.requests?.toLocaleString() || 0 }}</span>
            </div>
            <div class="info-row" v-if="userInfo.worker_count">
              <span class="label">Active Workers:</span>
              <span class="value">{{ userInfo.worker_count }}</span>
            </div>
          </div>

          <div v-else-if="userInfoError" class="error-message">
            {{ userInfoError }}
          </div>

          <button @click="refreshUserInfo" class="btn btn-secondary" :disabled="loadingUserInfo">
            {{ loadingUserInfo ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { settingsApi } from '../api/client.js'

export default {
  name: 'SettingsModal',
  emits: ['close'],
  setup() {
    const settings = ref({})
    const apiKey = ref('')
    const saving = ref(false)
    const userInfo = ref(null)
    const loadingUserInfo = ref(false)
    const userInfoError = ref(null)

    const loadSettings = async () => {
      try {
        const response = await settingsApi.get()
        settings.value = response.data
        if (settings.value.hasApiKey) {
          loadUserInfo()
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }

    const saveApiKey = async () => {
      try {
        saving.value = true
        const response = await settingsApi.update({ apiKey: apiKey.value })
        settings.value = response.data
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
        loadingUserInfo.value = true
        userInfoError.value = null
        const response = await settingsApi.getHordeUser()
        userInfo.value = response.data
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

    onMounted(() => {
      loadSettings()
    })

    return {
      settings,
      apiKey,
      saving,
      userInfo,
      loadingUserInfo,
      userInfoError,
      saveApiKey,
      refreshUserInfo
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: #1a1a1a;
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
  color: #999;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
}

.section {
  margin-bottom: 2rem;
}

.section:last-child {
  margin-bottom: 0;
}

.section h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1.125rem;
  color: #fff;
}

.help-text {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  color: #999;
  line-height: 1.5;
}

.help-text a {
  color: #007AFF;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

.form-group {
  display: flex;
  gap: 0.75rem;
}

.api-key-input {
  flex: 1;
  padding: 0.75rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
  font-family: monospace;
}

.api-key-input:focus {
  outline: none;
  border-color: #007AFF;
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
  background: #007AFF;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0051D5;
}

.btn-secondary {
  background: transparent;
  color: #007AFF;
  border: 1px solid #007AFF;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.1);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  padding: 1rem;
  text-align: center;
  color: #999;
}

.account-info {
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #222;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  color: #999;
  font-size: 0.9rem;
}

.info-row .value {
  color: #fff;
  font-weight: 500;
}

.info-row .value.kudos {
  color: #007AFF;
  font-weight: 600;
}

.error-message {
  padding: 1rem;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 6px;
  color: #ff3b30;
  margin-bottom: 1rem;
}
</style>
