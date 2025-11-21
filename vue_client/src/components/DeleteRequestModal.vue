<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ isOngoingRequest ? 'Cancel Request' : 'Delete Request' }}</h2>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <!-- Simple confirmation for ongoing requests -->
        <template v-if="isOngoingRequest">
          <p>Cancel this ongoing request?</p>

          <div class="option-buttons">
            <button @click="$emit('delete', 'cancel')" class="btn btn-confirm">
              <div class="btn-title">Yes, Cancel Request</div>
              <div class="btn-description">Stop processing and remove this request</div>
            </button>

            <button @click="$emit('close')" class="btn btn-cancel">
              <div class="btn-title">No, Keep Request</div>
              <div class="btn-description">Don't cancel this request</div>
            </button>
          </div>
        </template>

        <!-- Detailed options for completed requests -->
        <template v-else>
          <p>What would you like to do with the images from this request?</p>

          <div class="option-buttons">
            <button @click="$emit('delete', 'prune')" class="btn btn-prune">
              <div class="btn-title">Prune Images</div>
              <div class="btn-description">Delete non-favorited/hidden images</div>
            </button>

            <button @click="$emit('delete', 'hide')" class="btn btn-hide">
              <div class="btn-title">Keep & Hide All Images</div>
              <div class="btn-description">Mark all images as hidden and preserve them</div>
            </button>

            <button @click="$emit('delete', 'keep')" class="btn btn-keep">
              <div class="btn-title">Keep All Images</div>
              <div class="btn-description">Preserve all images from this request</div>
            </button>

            <button @click="$emit('close')" class="btn btn-cancel">
              <div class="btn-title">Cancel</div>
              <div class="btn-description">Don't delete this request</div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'DeleteRequestModal',
  props: {
    request: {
      type: Object,
      default: () => null
    }
  },
  emits: ['close', 'delete'],
  setup(props) {
    const isOngoingRequest = computed(() => {
      if (!props.request) {
        return false
      }
      const ongoingStatuses = ['pending', 'submitting', 'processing', 'downloading']
      return ongoingStatuses.includes(props.request.status)
    })

    return {
      isOngoingRequest
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
  max-width: 500px;
  width: 100%;
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

.modal-body p {
  margin: 0 0 1.5rem 0;
  color: var(--color-gray-300);
  font-size: 1rem;
}

.option-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn {
  padding: 1rem 1.25rem;
  border: 1px solid #333;
  border-radius: 8px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-light);
}

.btn-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.btn-description {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
}

.btn-prune:hover {
  border-color: var(--color-danger-hover);
}

.btn-prune:hover .btn-title {
  color: var(--color-danger-hover);
}

.btn-hide:hover {
  border-color: var(--color-warning);
}

.btn-hide:hover .btn-title {
  color: var(--color-warning);
}

.btn-keep:hover {
  border-color: var(--color-primary);
}

.btn-keep:hover .btn-title {
  color: var(--color-primary);
}

.btn-cancel:hover {
  border-color: var(--color-text-disabled);
}

.btn-confirm:hover {
  border-color: var(--color-danger-hover);
}

.btn-confirm:hover .btn-title {
  color: var(--color-danger-hover);
}
</style>
