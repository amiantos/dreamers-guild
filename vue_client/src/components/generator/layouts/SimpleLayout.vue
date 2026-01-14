<template>
  <div class="simple-layout">
    <!-- Basic Settings Section -->
    <h4 class="section-title">Basic Settings</h4>
    <div class="section-box basic-settings-section">
      <PromptSection :showNegativePrompt="false" />
      <ImageCountSection />
      <AlbumSection />
    </div>

    <!-- Style Section -->
    <h4 class="section-title">Style</h4>
    <div class="section-box inline-styles-section">
      <StyleSection />
    </div>
  </div>
</template>

<script setup>
import PromptSection from '../sections/PromptSection.vue'
import ImageCountSection from '../sections/ImageCountSection.vue'
import AlbumSection from '../sections/AlbumSection.vue'
import StyleSection from '../sections/StyleSection.vue'
</script>

<style scoped>
.simple-layout {
  display: flex;
  flex-direction: column;
  padding-bottom: 1rem;
  flex: 1;
  min-height: 0;
}

.section-title {
  margin: 1.5rem 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.section-title:first-child {
  margin-top: 0;
}

.section-box {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.basic-settings-section {
  flex-shrink: 0;
}

.section-box :deep(.form-group) {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 1rem;
}

/* Only the very last form-group in a section-box should lose its border */
.section-box :deep(> *:last-child .form-group:last-child),
.section-box :deep(> *:last-child > .form-group:last-child),
.section-box :deep(> .form-group:last-child) {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.inline-styles-section {
  flex: 1;
  min-height: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.simple-layout::after {
  content: '';
  display: block;
  height: 1rem;
  flex-shrink: 0;
}

.inline-styles-section :deep(.style-section-wrapper) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.inline-styles-section :deep(.inline-style-picker) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

</style>
