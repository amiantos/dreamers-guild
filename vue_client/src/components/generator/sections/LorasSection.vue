<template>
  <div class="loras-section">
    <div class="form-group">
      <button
        type="button"
        class="btn btn-browse-loras"
        @click="showLoraPicker = true"
      >
        Browse LoRAs
      </button>
      <div v-if="form.loras.length > 0" class="loras-list">
        <div
          v-for="(lora, idx) in form.loras"
          :key="`lora-${idx}`"
          class="lora-card"
        >
          <!-- Lora Header -->
          <div class="lora-header">
            <div class="lora-title-section">
              <span class="lora-title">{{ lora.name }}</span>
              <span v-if="currentLoraVersion(lora)" class="lora-version">{{ currentLoraVersion(lora).name }}</span>
            </div>
            <div class="lora-actions">
              <button
                type="button"
                class="btn-icon-small"
                @click="showLoraInfo(lora)"
                title="Show LoRA details"
                :disabled="lora.isManualEntry"
              >
                <i class="fas fa-info-circle"></i>
              </button>
              <button
                type="button"
                class="btn-icon-small btn-danger"
                @click="removeLora(idx)"
                title="Remove LoRA"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Model Strength -->
          <div class="lora-control-group">
            <label class="lora-control-label">Model Strength</label>
            <div class="slider-group">
              <input
                type="range"
                v-model.number="lora.strength"
                :style="{ background: getSliderBackground(lora.strength, -5, 5) }"
                @input="onLoraStrengthChange(idx)"
                min="-5"
                max="5"
                step="0.05"
              />
              <span class="range-value">{{ lora.strength }}</span>
            </div>
          </div>

          <!-- CLIP Strength -->
          <div class="lora-control-group">
            <label class="lora-control-label">CLIP Strength</label>
            <div class="slider-group">
              <input
                type="range"
                v-model.number="lora.clip"
                :style="{ background: getSliderBackground(lora.clip, -5, 5) }"
                @input="onLoraClipChange(idx)"
                min="-5"
                max="5"
                step="0.05"
              />
              <span class="range-value">{{ lora.clip }}</span>
            </div>
          </div>

          <!-- Trigger Words -->
          <div v-if="loraTrainedWords(lora).length > 0" class="lora-trigger-words">
            <span class="trigger-label">Trigger words:</span>
            <div class="trigger-chips">
              <button
                type="button"
                v-for="word in loraTrainedWords(lora)"
                :key="word"
                class="trigger-chip"
                @click="addTriggerWord(word)"
                :title="`Add '${word}' to prompt`"
              >
                {{ word }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const {
  form,
  showLoraPicker,
  getSliderBackground,
  currentLoraVersion,
  loraTrainedWords,
  addTriggerWord,
  showLoraInfo,
  removeLora,
  onLoraStrengthChange,
  onLoraClipChange
} = inject(GeneratorFormKey)
</script>

<style scoped>
.loras-section {
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 1rem;
}

.btn-browse-loras {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-browse-loras:hover {
  background: var(--color-primary-hover);
}

.loras-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lora-card {
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
}

.lora-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.lora-title-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.lora-title {
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lora-version {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.lora-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon-small {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon-small:hover:not(:disabled) {
  background: var(--color-border);
  color: var(--color-text-primary);
}

.btn-icon-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon-small.btn-danger:hover:not(:disabled) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: white;
}

.lora-control-group {
  margin-bottom: 0.75rem;
}

.lora-control-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-group input[type="range"] {
  flex: 1;
  width: auto;
  height: 5px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-border);
  border: none;
  outline: none;
  cursor: pointer;
  padding: 0;
  border-radius: 2px;
}

/* WebKit track */
.slider-group input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 5px;
  background: transparent;
  border-radius: 2px;
}

/* WebKit thumb */
.slider-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  background: #eee;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -10.5px;
  transition: all 0.15s ease;
}

.slider-group input[type="range"]::-webkit-slider-thumb:hover {
  background: var(--color-primary-hover);
  transform: scale(1.1);
}

/* Firefox track */
.slider-group input[type="range"]::-moz-range-track {
  width: 100%;
  height: 5px;
  background: transparent;
  border-radius: 2px;
  border: none;
}

/* Firefox thumb */
.slider-group input[type="range"]::-moz-range-thumb {
  width: 24px;
  height: 24px;
  background: #eee;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slider-group input[type="range"]::-moz-range-thumb:hover {
  background: var(--color-primary-hover);
  transform: scale(1.1);
}

.range-value {
  display: inline-block;
  min-width: 50px;
  text-align: center;
  padding: 0.5rem;
  color: var(--color-text-primary);
  font-size: 1rem;
}

.lora-trigger-words {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.trigger-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.trigger-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.trigger-chip {
  padding: 0.25rem 0.625rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.trigger-chip:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}
</style>
