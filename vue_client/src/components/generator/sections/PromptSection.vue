<template>
  <div class="prompt-section">
    <div class="form-group">
      <label for="prompt">Prompt *</label>
      <textarea
        id="prompt"
        ref="promptTextarea"
        v-model="form.prompt"
        @input="autoExpand"
        placeholder="Describe the image you want to generate..."
        rows="4"
        required
      ></textarea>
    </div>

    <div v-if="showNegativePrompt" class="form-group">
      <label for="negative_prompt">Negative Prompt</label>
      <textarea
        id="negative_prompt"
        ref="negativePromptTextarea"
        v-model="form.negativePrompt"
        @input="autoExpand"
        placeholder="Things to avoid in the image..."
        rows="2"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const props = defineProps({
  showNegativePrompt: {
    type: Boolean,
    default: true
  }
})

const { form, autoExpand } = inject(GeneratorFormKey)

const promptTextarea = ref(null)
const negativePromptTextarea = ref(null)
</script>

<style scoped>
.prompt-section {
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
}

.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  overflow-y: hidden;
  min-height: 80px;
  transition: height 0.1s ease;
  box-sizing: border-box;
}

#negative_prompt {
  min-height: 50px;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group textarea::placeholder {
  color: var(--color-text-muted);
}
</style>
