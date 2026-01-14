<template>
  <div class="dimensions-section">
    <div class="form-group">
      <label for="width">Width</label>
      <div class="slider-group">
        <input
          type="range"
          id="width"
          v-model.number="form.width"
          :style="{ background: getSliderBackground(form.width, 64, 3072) }"
          @input="onDimensionChange('width')"
          min="64"
          max="3072"
          step="64"
        />
        <span class="range-value">{{ form.width }}</span>
      </div>
    </div>

    <div class="form-group">
      <label for="height">Height</label>
      <div class="slider-group">
        <input
          type="range"
          id="height"
          v-model.number="form.height"
          :style="{ background: getSliderBackground(form.height, 64, 3072) }"
          @input="onDimensionChange('height')"
          min="64"
          max="3072"
          step="64"
        />
        <span class="range-value">{{ form.height }}</span>
      </div>
    </div>

    <div class="form-group">
      <label>Aspect Ratio</label>
      <div class="aspect-ratio-control">
        <span class="aspect-ratio-text">{{ aspectRatioText }}</span>
        <label class="toggle-switch">
          <input
            type="checkbox"
            v-model="aspectLocked"
            @change="onAspectLockToggle"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <button
        type="button"
        class="btn btn-swap-dimensions"
        @click="swapDimensions"
      >
        <i class="fa-solid fa-arrows-rotate"></i> Swap Dimensions
      </button>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const {
  form,
  aspectLocked,
  aspectRatioText,
  getSliderBackground,
  onDimensionChange,
  onAspectLockToggle,
  swapDimensions
} = inject(GeneratorFormKey)
</script>

<style scoped>
.dimensions-section {
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

.aspect-ratio-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.aspect-ratio-text {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

/* iOS-style Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 51px;
  height: 31px;
  margin: 0;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.btn-swap-dimensions {
  width: 100%;
  padding: 0.75rem 1.5rem;
  margin-top: 1rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-swap-dimensions:hover {
  background: var(--color-primary-hover);
}

.btn-swap-dimensions:active {
  transform: scale(0.98);
}
</style>
