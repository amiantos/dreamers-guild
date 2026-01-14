<template>
  <div class="qr-code-section">
    <div class="toggle-control">
      <span>Enable QR Code</span>
      <label class="toggle-switch">
        <input type="checkbox" v-model="form.qrCodeEnabled" />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <div v-if="form.qrCodeEnabled" class="qr-code-controls">
      <div class="form-group">
        <label for="qr_code_text">QR Code Content</label>
        <input
          type="text"
          id="qr_code_text"
          v-model="form.qrCodeText"
          placeholder="Enter URL or text for QR code..."
          class="text-input"
        />
      </div>

      <div class="form-group">
        <label for="qr_code_position">Position</label>
        <select id="qr_code_position" v-model="form.qrCodePosition">
          <option value="center">Center</option>
          <option value="top_left">Top Left</option>
          <option value="top_right">Top Right</option>
          <option value="bottom_left">Bottom Left</option>
          <option value="bottom_right">Bottom Right</option>
        </select>
      </div>

      <p class="info-text">
        QR codes are 512x512 pixels, so positioning only works if your image is larger than that.<br/>
        QR codes only work with SD 1.5 and SDXL models.
      </p>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { form } = inject(GeneratorFormKey)
</script>

<style scoped>
.qr-code-section {
  display: flex;
  flex-direction: column;
}

.toggle-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
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

.info-text {
  margin: 0.5rem 0 0 0;
  padding: 0 1rem;
  color: var(--color-text-tertiary);
  font-size: 0.8rem;
  line-height: 1.4;
  text-align: center;
}

.form-group:last-of-type {
  margin-bottom: 0;
}

.qr-code-controls {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
}

.text-input {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  box-sizing: border-box;
}

.text-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.text-input::placeholder {
  color: var(--color-text-tertiary);
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
