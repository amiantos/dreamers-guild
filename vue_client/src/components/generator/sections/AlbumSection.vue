<template>
  <div class="form-group">
    <label for="album">Save to Album</label>
    <select id="album" v-model="selectedAlbumId" class="album-select">
      <option :value="null">None</option>
      <option v-for="album in albums" :key="album.id" :value="album.id">
        {{ album.title }}{{ album.is_hidden ? ' (Hidden)' : '' }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const { albums, selectedAlbumId } = inject(GeneratorFormKey)
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

.album-select {
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

.album-select:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>
