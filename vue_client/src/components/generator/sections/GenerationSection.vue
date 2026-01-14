<template>
  <div class="generation-section">
    <div class="form-group">
      <label for="steps">Steps</label>
      <div class="slider-group">
        <input
          type="range"
          id="steps"
          v-model.number="form.steps"
          :style="{ background: getSliderBackground(form.steps, 1, 150) }"
          min="1"
          max="150"
          step="1"
        />
        <span class="range-value">{{ form.steps }}</span>
      </div>
    </div>

    <div class="form-group">
      <label for="cfg_scale">Guidance</label>
      <div class="slider-group">
        <input
          type="range"
          id="cfg_scale"
          v-model.number="form.cfgScale"
          :style="{ background: getSliderBackground(form.cfgScale, 1, 30) }"
          min="1"
          max="30"
          step="0.5"
        />
        <span class="range-value">{{ form.cfgScale }}</span>
      </div>
    </div>

    <div class="form-group">
      <label for="clip_skip">CLIP Skip</label>
      <div class="slider-group">
        <input
          type="range"
          id="clip_skip"
          v-model.number="form.clipSkip"
          :style="{ background: getSliderBackground(form.clipSkip, 1, 12) }"
          min="1"
          max="12"
          step="1"
        />
        <span class="range-value">{{ form.clipSkip }}</span>
      </div>
    </div>

    <div class="form-group">
      <label>Seed</label>
      <div class="seed-control-group">
        <input
          v-if="!form.useRandomSeed"
          type="text"
          id="seed"
          v-model="form.seed"
          placeholder="Enter seed number"
          class="seed-input"
        />
        <div class="seed-randomize">
          <span>Randomize Seed</span>
          <label class="toggle-switch">
            <input type="checkbox" v-model="form.useRandomSeed" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>Other Options</label>
      <div class="toggle-control">
        <span>Karras</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="form.karras" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="hires-fix-container">
        <div class="toggle-control">
          <span>Hires Fix</span>
          <label class="toggle-switch">
            <input type="checkbox" v-model="form.hiresFix" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div v-if="form.hiresFix" class="hires-fix-controls">
          <label for="hires_denoise">Denoising Strength</label>
          <div class="slider-group">
            <input
              type="range"
              id="hires_denoise"
              v-model.number="form.hiresFixDenoisingStrength"
              :style="{ background: getSliderBackground(form.hiresFixDenoisingStrength, 0, 1) }"
              min="0"
              max="1"
              step="0.05"
            />
            <span class="range-value">{{ form.hiresFixDenoisingStrength }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { form, getSliderBackground } = inject(GeneratorFormKey)
</script>

<style scoped>
.generation-section {
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

.seed-control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.seed-input {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-family: inherit;
}

.seed-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.seed-randomize {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.seed-randomize span {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.toggle-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-control span {
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

.hires-fix-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hires-fix-controls {
  margin-top: 0.5rem;
}

.hires-fix-controls label {
  font-size: 0.9rem;
  font-weight: normal;
  color: var(--color-text-tertiary);
}
</style>
