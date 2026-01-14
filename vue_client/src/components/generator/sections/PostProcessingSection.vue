<template>
  <div class="post-processing-section">
    <div class="form-group">
      <label for="face_fix">Face Fix</label>
      <select id="face_fix" v-model="form.faceFix">
        <option value="none">None</option>
        <option value="GFPGAN">GFPGAN</option>
        <option value="CodeFormers">CodeFormers</option>
      </select>
      <div v-if="form.faceFix !== 'none'" class="form-group-internal">
        <label for="face_fix_strength">Face Fix Strength</label>
        <div class="slider-group">
          <input
            type="range"
            id="face_fix_strength"
            v-model.number="form.faceFixStrength"
            :style="{ background: getSliderBackground(form.faceFixStrength, 0, 1) }"
            min="0"
            max="1"
            step="0.05"
          />
          <span class="range-value">{{ form.faceFixStrength }}</span>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label for="upscaler">Upscaler</label>
      <select id="upscaler" v-model="form.upscaler">
        <option value="none">None</option>
        <option value="RealESRGAN_x4plus">RealESRGAN x4</option>
        <option value="RealESRGAN_x4plus_anime_6B">RealESRGAN x4 Anime</option>
        <option value="RealESRGAN_x2plus">RealESRGAN x2</option>
        <option value="NMKD_Siax">NMKD Siax</option>
        <option value="4x_AnimeSharp">4x AnimeSharp</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { form, getSliderBackground } = inject(GeneratorFormKey)
</script>

<style scoped>
.post-processing-section {
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

.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1em;
  padding-right: 2.5rem;
}

.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group-internal {
  margin-top: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.form-group-internal label {
  font-weight: normal;
  font-size: 0.9rem;
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
