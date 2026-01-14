<template>
  <div class="model-section">
    <div class="form-group">
      <label>Model</label>
      <div class="selector-button" @click="showModelPicker = true">
        <span class="selector-value">{{ form.model || 'Loading...' }}</span>
        <span class="selector-arrow">›</span>
      </div>
    </div>

    <div class="form-group">
      <label>Sampler</label>
      <select id="sampler" v-model="form.sampler">
        <option value="k_euler">Euler</option>
        <option value="k_euler_a">Euler a</option>
        <option value="k_dpm_2">DPM 2</option>
        <option value="k_dpm_2_a">DPM 2 a</option>
        <option value="k_heun">Heun</option>
        <option value="k_dpm_fast">DPM fast</option>
        <option value="k_dpm_adaptive">DPM adaptive</option>
        <option value="k_lms">LMS</option>
        <option value="ddim">DDIM</option>
        <option value="k_dpmpp_2m">DPM++ 2M</option>
        <option value="k_dpmpp_2s_a">DPM++ 2S a</option>
        <option value="k_dpmpp_sde">DPM++ SDE</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { form, showModelPicker } = inject(GeneratorFormKey)
</script>

<style scoped>
.model-section {
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

.selector-button {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-button:hover {
  background: #252525;
  border-color: var(--color-border-light);
}

.selector-value {
  flex: 1;
  text-align: left;
}

.selector-arrow {
  color: var(--color-text-tertiary);
  font-size: 1.5rem;
  font-weight: 300;
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
</style>
