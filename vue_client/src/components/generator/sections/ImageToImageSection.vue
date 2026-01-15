<template>
  <div class="img2img-section">
    <!-- Dropzone / Image Preview -->
    <div
      class="dropzone"
      :class="{ 'has-image': hasSourceImage, 'drag-active': isDragActive }"
      @dragenter.prevent="onDragEnter"
      @dragleave.prevent="onDragLeave"
      @dragover.prevent
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <!-- Empty state -->
      <div v-if="!hasSourceImage" class="dropzone-empty">
        <i class="fa-solid fa-image"></i>
        <p>Drag & drop an image here</p>
        <p class="dropzone-hint">or click to browse, or paste from clipboard</p>
      </div>

      <!-- Image preview -->
      <div v-else class="image-preview">
        <img :src="form.sourceImagePreview" alt="Source image" />
        <button @click.stop="removeImage" class="btn-remove" title="Remove image">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        @change="onFileSelect"
        hidden
      />
    </div>

    <!-- Controls (visible when image is present) -->
    <div v-if="hasSourceImage" class="img2img-controls">
      <!-- Denoise Strength Slider -->
      <div class="form-group">
        <label for="denoise_strength">Denoise Strength</label>
        <div class="slider-group">
          <input
            type="range"
            id="denoise_strength"
            v-model.number="form.denoisingStrength"
            :style="{ background: getSliderBackground(form.denoisingStrength, 0, 1) }"
            min="0"
            max="1"
            step="0.05"
          />
          <span class="range-value">{{ form.denoisingStrength }}</span>
        </div>
      </div>

      <!-- ControlNet Type Dropdown -->
      <div class="form-group">
        <label for="control_type">ControlNet Type</label>
        <select id="control_type" v-model="form.controlType">
          <option :value="null">None</option>
          <option value="canny">Canny</option>
          <option value="hed">HED</option>
          <option value="depth">Depth</option>
          <option value="normal">Normal</option>
          <option value="openpose">OpenPose</option>
          <option value="seg">Segmentation</option>
          <option value="scribble">Scribble</option>
          <option value="fakescribbles">Fake Scribbles</option>
          <option value="hough">Hough</option>
        </select>
      </div>

      <!-- ControlNet Toggles (visible when ControlNet is selected) -->
      <div v-if="form.controlType" class="controlnet-toggles">
        <div class="toggle-control">
          <span>Image is Control Map</span>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="form.imageIsControl"
              @change="onImageIsControlChange"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="toggle-control">
          <span>Return Control Map</span>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="form.returnControlMap"
              @change="onReturnControlMapChange"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, computed, ref, onMounted, onUnmounted } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'

const {
  form,
  getSliderBackground,
  processAndSetSourceImage,
  removeSourceImage
} = inject(GeneratorFormKey)

const fileInput = ref(null)
const isDragActive = ref(false)

const hasSourceImage = computed(() => !!form.sourceImage)

// File input handling
const triggerFileInput = () => {
  if (!hasSourceImage.value) {
    fileInput.value?.click()
  }
}

const onFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (file) {
    const success = await processAndSetSourceImage(file)
    if (success) {
      // Turn off QR code when image is added (mutually exclusive)
      form.qrCodeEnabled = false
    }
  }
  event.target.value = '' // Reset for re-selection
}

// Drag and drop handling
const onDragEnter = () => {
  isDragActive.value = true
}

const onDragLeave = (event) => {
  // Only set to false if we're actually leaving the dropzone
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragActive.value = false
  }
}

const onDrop = async (event) => {
  isDragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    const success = await processAndSetSourceImage(file)
    if (success) {
      // Turn off QR code when image is added (mutually exclusive)
      form.qrCodeEnabled = false
    }
  }
}

// Clipboard paste handling
const onPaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        const success = await processAndSetSourceImage(file)
        if (success) {
          // Turn off QR code when image is added (mutually exclusive)
          form.qrCodeEnabled = false
        }
        break
      }
    }
  }
}

const removeImage = () => {
  removeSourceImage()
}

// Toggle mutual exclusivity
const onImageIsControlChange = () => {
  if (form.imageIsControl && form.returnControlMap) {
    form.returnControlMap = false
  }
}

const onReturnControlMapChange = () => {
  if (form.returnControlMap && form.imageIsControl) {
    form.imageIsControl = false
  }
}

onMounted(() => {
  document.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  document.removeEventListener('paste', onPaste)
})
</script>

<style scoped>
.img2img-section {
  display: flex;
  flex-direction: column;
}

.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.02);
}

.dropzone:hover:not(.has-image) {
  border-color: var(--color-primary);
  background: rgba(88, 114, 151, 0.1);
}

.dropzone.drag-active {
  border-color: var(--color-primary);
  background: rgba(88, 114, 151, 0.15);
  border-style: solid;
}

.dropzone.has-image {
  padding: 0;
  border-style: solid;
  border-color: var(--color-border);
  cursor: default;
}

.dropzone-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-tertiary);
}

.dropzone-empty i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.dropzone-empty p {
  margin: 0;
  font-size: 0.9rem;
}

.dropzone-hint {
  font-size: 0.8rem !important;
  opacity: 0.7;
}

.image-preview {
  position: relative;
  width: 100%;
}

.image-preview img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 6px;
}

.btn-remove {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-remove:hover {
  background: rgba(220, 53, 69, 0.9);
  transform: scale(1.1);
}

.img2img-controls {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.form-group {
  margin-bottom: 1rem;
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

.controlnet-toggles {
  margin-top: 0.5rem;
}

/* Remove border from ControlNet dropdown when toggles are visible */
.form-group:has(+ .controlnet-toggles) {
  border-bottom: none !important;
  padding-bottom: 0 !important;
  margin-bottom: 0 !important;
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
</style>
