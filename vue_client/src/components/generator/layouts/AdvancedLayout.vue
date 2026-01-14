<template>
  <div class="advanced-layout">
    <!-- Basic Settings Section -->
    <h4 class="section-title">Basic Settings</h4>
    <div class="section-box basic-settings-section">
      <PromptSection :showNegativePrompt="true" />
      <ImageCountSection />
      <AlbumSection />
    </div>

    <!-- Dimensions Section -->
    <h4 class="section-title">Dimensions</h4>
    <div class="section-box dimensions-section">
      <DimensionsSection />
    </div>

    <!-- Generation Settings Section -->
    <h4 class="section-title">Advanced Generation Settings</h4>
    <div class="section-box generation-settings-section">
      <ModelSection />
      <GenerationSection />
    </div>

    <!-- LoRAs Section -->
    <h4 class="section-title">LoRAs</h4>
    <div class="section-box loras-section">
      <LorasSection />
    </div>

    <!-- Textual Inversions Section (hidden for now) -->
    <!-- <h4 class="section-title">Textual Inversions</h4>
    <div class="section-box tis-section">
      <TextualInversionsSection />
    </div> -->

    <!-- Post-Processing Section -->
    <h4 class="section-title">Post-Processing</h4>
    <div class="section-box post-processing-section">
      <PostProcessingSection />
    </div>

    <!-- Advanced Options Section -->
    <h4 class="section-title">Advanced Options</h4>
    <div class="section-box advanced-options-section">
      <AdvancedOptionsSection />
    </div>

    <!-- QR Code Section -->
    <h4 class="section-title">QR Code</h4>
    <div class="section-box qr-code-section">
      <QRCodeSection />
    </div>
  </div>
</template>

<script setup>
import PromptSection from '../sections/PromptSection.vue'
import ImageCountSection from '../sections/ImageCountSection.vue'
import AlbumSection from '../sections/AlbumSection.vue'
import DimensionsSection from '../sections/DimensionsSection.vue'
import ModelSection from '../sections/ModelSection.vue'
import GenerationSection from '../sections/GenerationSection.vue'
import LorasSection from '../sections/LorasSection.vue'
// import TextualInversionsSection from '../sections/TextualInversionsSection.vue'
import PostProcessingSection from '../sections/PostProcessingSection.vue'
import AdvancedOptionsSection from '../sections/AdvancedOptionsSection.vue'
import QRCodeSection from '../sections/QRCodeSection.vue'
</script>

<style scoped>
.advanced-layout {
  display: flex;
  flex-direction: column;
  padding-bottom: 1rem;
}

.section-title {
  margin: 1.5rem 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.05em;
}

.section-title:first-child {
  margin-top: 0;
}

.section-box {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 0;
}

/* Form group styling within section boxes */
.section-box :deep(.form-group) {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 1rem;
}

/* Section component wrappers - ensure spacing between section components in same box */
.section-box :deep(.prompt-section),
.section-box :deep(.model-section),
.section-box :deep(.generation-section),
.section-box :deep(.dimensions-section),
.section-box :deep(.loras-section),
.section-box :deep(.tis-section),
.section-box :deep(.post-processing-section),
.section-box :deep(.advanced-options-section),
.section-box :deep(.qr-code-section) {
  margin-bottom: 0;
}

/* Only the very last form-group in a section-box should lose its border */
.section-box :deep(> *:last-child .form-group:last-child),
.section-box :deep(> *:last-child > .form-group:last-child),
.section-box :deep(> .form-group:last-child) {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

/* LoRAs section specific styling */
.loras-section :deep(.form-group) {
  padding-bottom: 1.5rem;
}

.loras-section :deep(.loras-list) {
  margin-top: 0.75rem;
}

.loras-section :deep(.lora-card) {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 1rem;
}

/* Post-processing section specific styling */
.post-processing-section :deep(.form-group-internal) {
  padding-top: 1.5rem;
}

/* Advanced options section specific styling */
.advanced-options-section :deep(.toggle-list) {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.advanced-options-section :deep(.toggle-control) {
  border-bottom: none;
  padding: 0;
}

/* Dimensions section - swap button margin */
.dimensions-section :deep(.btn-swap-dimensions) {
  margin-top: 1rem;
}
</style>
