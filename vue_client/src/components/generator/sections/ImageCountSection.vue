<template>
  <div class="form-group">
    <label for="n">Images</label>
    <div class="slider-group">
      <input
        type="range"
        id="n"
        v-model.number="form.n"
        :style="{ background: getSliderBackground(form.n, 1, 20) }"
        min="1"
        max="20"
        step="1"
      />
      <span class="range-value">{{ form.n }}</span>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { form, getSliderBackground } = inject(GeneratorFormKey)
</script>

<style scoped>
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
</style>
