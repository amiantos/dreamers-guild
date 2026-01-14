<template>
  <div class="advanced-options-section">
    <div class="toggle-list">
      <div class="toggle-control">
        <span>Tiling</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="form.tiling" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="toggle-control">
        <span>Transparent Background</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="form.transparent" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="toggle-control">
        <span>Strip Background</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="form.stripBackground" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { form } = inject(GeneratorFormKey)
</script>

<style scoped>
.advanced-options-section {
  display: flex;
  flex-direction: column;
}

.toggle-list {
  display: flex;
  flex-direction: column;
}

.toggle-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.toggle-control:last-child {
  border-bottom: none;
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
</style>
