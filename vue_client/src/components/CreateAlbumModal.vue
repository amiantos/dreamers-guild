<template>
  <BaseModal
    :show="isOpen"
    @close="$emit('close')"
    size="small"
    :closeOnBackdrop="true"
  >
    <div class="create-album-modal">
      <div class="modal-header">
        <h2>Create Album</h2>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label for="album-name">Album Name</label>
          <input
            id="album-name"
            type="text"
            v-model="albumName"
            placeholder="Enter album name"
            ref="nameInput"
            required
          />
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="isHidden"
            />
            <span class="checkbox-text">Hidden Album</span>
          </label>
          <p class="hint">Hidden albums require authentication to view. Images added to hidden albums will be marked as hidden.</p>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">
            Cancel
          </button>
          <button type="submit" class="btn-create" :disabled="!albumName.trim() || isSubmitting">
            {{ isSubmitting ? 'Creating...' : 'Create Album' }}
          </button>
        </div>
      </form>
    </div>
  </BaseModal>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import { useToast } from '../composables/useToast.js'
import { useAlbumStore } from '../stores/albumStore.js'

export default {
  name: 'CreateAlbumModal',
  components: {
    BaseModal
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'created'],
  setup(props, { emit }) {
    const { showToast } = useToast()
    const albumStore = useAlbumStore()

    const albumName = ref('')
    const isHidden = ref(false)
    const isSubmitting = ref(false)
    const nameInput = ref(null)

    const handleSubmit = async () => {
      if (!albumName.value.trim() || isSubmitting.value) return

      isSubmitting.value = true

      try {
        const newAlbum = await albumStore.createAlbum({
          title: albumName.value.trim(),
          isHidden: isHidden.value
        })

        emit('created', newAlbum)
        emit('close')
        showToast('Album created successfully', 'success')

        // Reset form
        albumName.value = ''
        isHidden.value = false
      } catch (error) {
        console.error('Error creating album:', error)
        showToast('Failed to create album. Please try again.', 'error')
      } finally {
        isSubmitting.value = false
      }
    }

    onMounted(() => {
      // Focus the input when modal opens
      nextTick(() => {
        if (nameInput.value) {
          nameInput.value.focus()
        }
      })
    })

    return {
      albumName,
      isHidden,
      isSubmitting,
      nameInput,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.create-album-modal {
  padding: 1.5rem;
}

.modal-header {
  margin-bottom: 1.5rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-group input[type="text"] {
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-primary);
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group input[type="text"]::placeholder {
  color: var(--color-text-disabled);
}

.checkbox-group {
  padding: 1rem;
  background: var(--color-surface);
  border-radius: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.checkbox-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.hint {
  margin: 0.75rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-cancel,
.btn-create {
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-cancel:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.btn-create {
  background: var(--color-primary);
  border: none;
  color: var(--color-text-primary);
}

.btn-create:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
