<template>
  <div class="shared-keys-view">
    <div class="shared-keys-container">
      <div class="shared-keys-header">
        <h1>Manage Shared Keys</h1>
        <button @click="goBack" class="btn-back">
          <i class="fa-solid fa-arrow-left"></i> Back to Settings
        </button>
      </div>

      <p class="help-text">
        Shared keys allow you to share a limited amount of kudos with others.
      </p>

      <div v-if="loading" class="loading">Loading shared keys...</div>

      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-else-if="sharedKeys.length === 0" class="no-keys">
        <p>No shared keys created yet.</p>
      </div>

      <div v-else class="shared-keys-list">
        <div v-for="key in sharedKeys" :key="key.id" class="shared-key-card" :class="{ 'shared-key-expired': isExpired(key.expiry) }">
          <div class="shared-key-header">
            <div class="shared-key-name">
              {{ key.name || 'Unnamed Key' }}
              <span v-if="isExpired(key.expiry)" class="expired-badge">Expired</span>
            </div>
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
          <div v-if="key.expiry" class="shared-key-expiry" :class="{ 'expired': isExpired(key.expiry) }">
            {{ isExpired(key.expiry) ? 'Expired' : 'Expires' }}: {{ formatExpiryDate(key.expiry) }}
          </div>
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

      <button @click="createNewSharedKey" class="btn btn-primary create-btn">
        <i class="fa-solid fa-plus"></i> Create Shared Key
      </button>
    </div>

    <!-- Shared Key Modal -->
    <div v-if="sharedKeyModalOpen" class="modal-overlay" @click.self="sharedKeyModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editingKey ? 'Edit Shared Key' : 'Create Shared Key' }}</h2>
          <button class="btn-close" @click="sharedKeyModalOpen = false">&times;</button>
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
          <div class="form-group-vertical">
            <label>Expiry</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="keyForm.no_expiry" @change="handleUnlimitedChange('expiry')" />
                <span>No Expiry</span>
              </label>
            </div>
            <input
              v-if="!keyForm.no_expiry"
              type="number"
              v-model.number="keyForm.expiry"
              placeholder="Days (1-30)"
              class="input-field"
              min="1"
              max="30"
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { settingsApi } from '@api'

export default {
  name: 'SharedKeysView',
  setup() {
    const router = useRouter()
    const sharedKeys = ref([])
    const loading = ref(false)
    const error = ref(null)

    // Modal state
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
      unlimited_tokens: true,
      expiry: null,
      no_expiry: true
    })
    const keyFormError = ref('')
    const savingKey = ref(false)

    const goBack = () => {
      router.push('/settings')
    }

    const loadSharedKeys = async () => {
      try {
        loading.value = true
        error.value = null
        const response = await settingsApi.getHordeSharedKeys()
        sharedKeys.value = response
      } catch (err) {
        console.error('Error loading shared keys:', err)
        error.value = 'Failed to load shared keys. Please check your API key and try again.'
      } finally {
        loading.value = false
      }
    }

    const isExpired = (expiryDate) => {
      if (!expiryDate) return false
      return new Date(expiryDate) < new Date()
    }

    const formatExpiryDate = (expiryDate) => {
      if (!expiryDate) return null
      return new Date(expiryDate).toLocaleDateString()
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
        unlimited_tokens: true,
        expiry: null,
        no_expiry: true
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
        unlimited_tokens: key.max_text_tokens === -1 || !key.max_text_tokens,
        expiry: null,
        no_expiry: !key.expiry
      }
      keyFormError.value = ''
      sharedKeyModalOpen.value = true
    }

    const handleUnlimitedChange = (type) => {
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
      if (type === 'expiry' && keyForm.value.no_expiry) {
        keyForm.value.expiry = null
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

        if (!keyForm.value.no_expiry && keyForm.value.expiry) {
          data.expiry = keyForm.value.expiry
        }

        if (editingKey.value) {
          const updatedKey = await settingsApi.updateHordeSharedKey(editingKey.value.id, data)
          // Update the key in the local array instead of refetching
          const index = sharedKeys.value.findIndex(key => key.id === editingKey.value.id)
          if (index !== -1) {
            sharedKeys.value[index] = updatedKey
          }
          alert('Shared key updated successfully!')
        } else {
          const newKey = await settingsApi.createHordeSharedKey(data)
          // Add the new key to the local array instead of refetching
          sharedKeys.value.unshift(newKey)
          alert('Shared key created successfully!')
        }

        sharedKeyModalOpen.value = false
      } catch (err) {
        console.error('Error saving shared key:', err)
        keyFormError.value = err.response?.data?.error || 'Failed to save shared key'
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
        // Remove the key from the local array instead of refetching
        sharedKeys.value = sharedKeys.value.filter(key => key.id !== keyId)
        alert('Shared key deleted successfully!')
      } catch (err) {
        console.error('Error deleting shared key:', err)
        alert('Failed to delete shared key. Please try again.')
      }
    }

    const copySharedKey = (keyId) => {
      navigator.clipboard.writeText(keyId).then(() => {
        alert('Key ID copied to clipboard!')
      }).catch(err => {
        console.error('Error copying to clipboard:', err)
        alert('Failed to copy to clipboard')
      })
    }

    const copyShareUrl = (keyId) => {
      const url = `https://dreamers-guild.org/?api_key=${keyId}`
      navigator.clipboard.writeText(url).then(() => {
        alert('Share URL copied to clipboard!')
      }).catch(err => {
        console.error('Error copying to clipboard:', err)
        alert('Failed to copy to clipboard')
      })
    }

    onMounted(() => {
      loadSharedKeys()
    })

    return {
      sharedKeys,
      loading,
      error,
      sharedKeyModalOpen,
      editingKey,
      keyForm,
      keyFormError,
      savingKey,
      goBack,
      isExpired,
      formatExpiryDate,
      createNewSharedKey,
      editSharedKey,
      handleUnlimitedChange,
      saveSharedKey,
      deleteSharedKey,
      copySharedKey,
      copyShareUrl
    }
  }
}
</script>

<style scoped>
.shared-keys-view {
  min-height: 100vh;
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.shared-keys-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.shared-keys-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #333;
}

.shared-keys-header h1 {
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

.help-text {
  margin: 0 0 2rem 0;
  font-size: 0.95rem;
  color: var(--color-text-tertiary);
  line-height: 1.6;
}

.loading {
  padding: 3rem;
  text-align: center;
  color: var(--color-text-tertiary);
}

.error-message {
  padding: 1rem;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 6px;
  color: var(--color-danger-ios);
  margin-bottom: 1rem;
}

.no-keys {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-tertiary);
}

.shared-keys-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.shared-key-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #333;
}

.shared-key-card.shared-key-expired {
  border-color: var(--color-danger-ios, #dc3545);
  background-color: rgba(220, 53, 69, 0.1);
}

.shared-key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.shared-key-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.expired-badge {
  background-color: var(--color-danger-ios, #dc3545);
  color: white;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  margin-left: 0.5rem;
  text-transform: uppercase;
  font-weight: 600;
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

.shared-key-expiry {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin-bottom: 0.75rem;
}

.shared-key-expiry.expired {
  color: var(--color-danger-ios, #dc3545);
  font-weight: 500;
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

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Modal styles */
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .shared-keys-container {
    padding: 1rem;
  }

  .shared-keys-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .shared-keys-header h1 {
    font-size: 1.5rem;
  }

  .shared-key-card {
    padding: 1rem;
  }

  .shared-key-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .shared-key-stats {
    flex-wrap: wrap;
  }
}
</style>
