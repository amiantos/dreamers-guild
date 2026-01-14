<template>
  <div class="modal-footer">
    <!-- Kudos Estimate or Error -->
    <div class="kudos-estimate" v-if="kudosEstimate !== null || estimateError !== null">
      <span v-if="kudosEstimate !== null" class="kudos-label">
        ~{{ kudosEstimate.toLocaleString() }} kudos for {{ form.n.toLocaleString() }} images,
        ~{{ (kudosEstimate / form.n).toFixed(0).toLocaleString() }} per image
      </span>
      <span v-else-if="estimateError !== null" class="kudos-error">{{ estimateError }}</span>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button
        type="submit"
        @click="$emit('submit')"
        class="btn btn-submit"
        :disabled="submitting"
      >
        <i class="fa-regular fa-paper-plane paper-plane-icon"></i>
        {{ submitting ? 'Sending...' : 'Send Dream' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from './composables/useGeneratorForm.js'

defineProps({
  kudosEstimate: {
    type: Number,
    default: null
  },
  estimateError: {
    type: String,
    default: null
  }
})

defineEmits(['submit'])

const { form, submitting } = inject(GeneratorFormKey)
</script>

<style scoped>
.modal-footer {
  flex-shrink: 0;
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  border-top: 1px solid #333;
  background: var(--color-surface);
}

.kudos-estimate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.kudos-label {
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

.kudos-error {
  color: var(--color-danger-hover);
  font-size: 0.9rem;
  font-weight: 500;
}

.form-actions {
  display: flex;
  justify-content: center;
}

.btn-submit {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: var(--color-primary);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.paper-plane-icon {
  font-size: 0.875rem;
}
</style>
