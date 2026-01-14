<template>
  <div class="modal-header">
    <h2>New Dream</h2>
    <div class="header-actions">
      <button
        class="btn-mode-toggle"
        @click="toggleEditorMode"
        :title="editorMode === 'simple' ? 'Switch to Advanced mode' : 'Switch to Simple mode'"
      >
        {{ editorMode === 'simple' ? 'Advanced' : 'Styles' }}
      </button>
      <button
        class="btn-reset"
        @click="$emit('reset')"
        :title="editorMode === 'simple' ? 'Random prompt' : 'Clear form'"
      >
        <i v-if="editorMode === 'simple'" class="fas fa-shuffle"></i>
        <span v-else>Clear</span>
      </button>
      <button class="btn-close" @click="$emit('close')">×</button>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from './composables/useGeneratorForm.js'

defineEmits(['reset', 'close'])

const { editorMode, toggleEditorMode } = inject(GeneratorFormKey)
</script>

<style scoped>
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  background: var(--color-surface);
  z-index: 1;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-mode-toggle {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #333;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-mode-toggle:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}

.btn-reset {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #333;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
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
</style>
