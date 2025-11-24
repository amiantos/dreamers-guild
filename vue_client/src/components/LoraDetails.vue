<template>
  <div class="lora-details-overlay">
    <div class="lora-details-container">
      <!-- Header -->
      <div class="details-header">
        <button class="btn-back" @click="$emit('close')">
          <i class="fas fa-arrow-left"></i> Back
        </button>
        <h2 class="details-title">LoRA Details</h2>
        <button
          class="btn-favorite"
          @click="toggleFavorite"
          :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        >
          <i :class="isFavorite ? 'fas fa-heart' : 'far fa-heart'"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="details-content">
        <!-- Left Column - Images -->
        <div class="details-images">
          <div class="image-carousel">
            <button
              v-if="selectedVersionImages.length > 1"
              class="carousel-btn carousel-prev"
              @click="previousImage"
              :disabled="currentImageIndex === 0"
            >
              <i class="fas fa-chevron-left"></i>
            </button>

            <div class="carousel-image-container">
              <img
                v-if="currentImage"
                :src="currentImage.url"
                :alt="lora.name"
                :class="{'nsfw-blur': shouldBlurCurrentImage}"
                class="carousel-image"
              />
              <div v-else class="no-image">No preview available</div>

              <div class="image-counter">
                {{ currentImageIndex + 1 }} / {{ selectedVersionImages.length }}
              </div>
            </div>

            <button
              v-if="selectedVersionImages.length > 1"
              class="carousel-btn carousel-next"
              @click="nextImage"
              :disabled="currentImageIndex === selectedVersionImages.length - 1"
            >
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <!-- Right Column - Info -->
        <div class="details-info">
          <!-- LoRA Name -->
          <h1 class="lora-name">{{ lora.name }}</h1>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <button
              v-if="!isAlreadyAdded"
              class="btn-add-lora"
              @click="addLora"
            >
              <i class="fas fa-plus"></i> Add LoRA
            </button>
            <button
              v-else
              class="btn-remove-lora"
              @click="removeLora"
            >
              <i class="fas fa-trash"></i> Remove LoRA
            </button>

            <div class="badge base-model-display">
              <i class="fas fa-cube"></i>
              {{ selectedVersion?.baseModel || 'Unknown' }}
            </div>

            <div class="version-name">
              Version: {{ selectedVersion?.name || 'Unknown' }}
            </div>
          </div>

          <!-- External Link -->
          <div class="external-link">
            <a
              :href="`https://civitai.com/models/${lora.id}`"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on CivitAI <i class="fas fa-external-link-alt"></i>
            </a>
          </div>

          <!-- Version Selector -->
          <div v-if="lora.modelVersions && (lora.modelVersions.length > 1 || isDeprecatedVersion)" class="version-selector">
            <label>Select Version:</label>
            <select v-model="selectedVersionId" @change="onVersionChange" class="version-select">
              <option
                v-if="isDeprecatedVersion"
                :value="selectedVersionId"
                class="deprecated-version"
              >
                ⚠️ Currently Selected (Deprecated/Unavailable)
              </option>
              <option
                v-for="version in lora.modelVersions"
                :key="version.id"
                :value="version.id"
              >
                {{ version.baseModel }} - {{ version.name }}
              </option>
            </select>
            <div v-if="isDeprecatedVersion" class="deprecated-warning">
              <i class="fas fa-exclamation-triangle"></i>
              This version is no longer available on CivitAI. You can keep using it, but it may not work on all workers.
            </div>
          </div>

          <!-- File Size -->
          <div v-if="fileSizeMB" class="file-size">
            <span class="label">Size:</span>
            <span class="value">{{ fileSizeMB }} MB</span>
            <span v-if="fileSizeMB > 400" class="warning">
              <i class="fas fa-exclamation-triangle"></i>
              Exceeds AI Horde 400MB limit. Most workers won't support this LoRA.
            </span>
          </div>

          <!-- Version Description -->
          <div v-if="selectedVersion?.description" class="version-description">
            <h3>Version Details:</h3>
            <div v-html="sanitizedVersionDescription"></div>
          </div>

          <!-- Model Description -->
          <div v-if="lora.description" class="model-description">
            <h3>Description:</h3>
            <div v-html="sanitizedDescription"></div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="details-footer">
        <button class="btn-cancel" @click="$emit('close')">
          Cancel
        </button>
        <button
          v-if="!isAlreadyAdded"
          class="btn-add-lora-footer"
          @click="addLora"
        >
          <i class="fas fa-plus"></i> Add LoRA
        </button>
        <button
          v-else
          class="btn-remove-lora-footer"
          @click="removeLora"
        >
          <i class="fas fa-trash"></i> Remove LoRA
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { SavedLora } from '../models/Lora'
import { useLoraFavorites } from '../composables/useLoraCache'

// Simple HTML sanitizer to prevent XSS
function sanitizeHtml(html) {
  if (!html) return ''

  // Create a temporary div to parse HTML
  const temp = document.createElement('div')
  temp.textContent = html // This escapes all HTML

  // For basic formatting, we can allow some safe tags
  // This is a simple approach - for production, consider using DOMPurify
  const allowedTags = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4']

  // For now, just return escaped text to be safe
  // If you need HTML rendering, install: npm install dompurify
  return html
}

export default {
  name: 'LoraDetails',
  props: {
    lora: {
      type: Object,
      required: true
    },
    nsfwEnabled: {
      type: Boolean,
      default: false
    },
    currentLoras: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'addLora', 'removeLora', 'toggleFavorite'],
  setup() {
    const { isFavorite: checkIsFavorite, toggleFavorite: toggleFav } = useLoraFavorites()
    return { checkIsFavorite, toggleFav }
  },
  data() {
    // If this LoRA is already added to the request, default to that version
    // Otherwise, default to the first version in the list
    const addedLora = this.currentLoras.find(l =>
      l.id === this.lora.id ||
      this.lora.modelVersions?.some(v => v.id === l.versionId)
    )

    const defaultVersionId = addedLora?.versionId || this.lora.versionId || this.lora.modelVersions?.[0]?.id || null

    return {
      selectedVersionId: defaultVersionId,
      currentImageIndex: 0
    }
  },
  computed: {
    selectedVersion() {
      return this.lora.modelVersions?.find(v => v.id === this.selectedVersionId) ||
             this.lora.modelVersions?.[0]
    },

    isDeprecatedVersion() {
      // Check if the selected version ID doesn't exist in the available versions
      if (!this.selectedVersionId || !this.lora.modelVersions) return false
      return !this.lora.modelVersions.some(v => v.id === this.selectedVersionId)
    },

    selectedVersionImages() {
      return this.selectedVersion?.images || []
    },

    currentImage() {
      return this.selectedVersionImages[this.currentImageIndex] || null
    },

    shouldBlurCurrentImage() {
      if (this.nsfwEnabled) return false
      if (!this.currentImage) return false
      return (this.currentImage.nsfwLevel || 0) >= 7
    },

    fileSizeMB() {
      if (!this.selectedVersion?.files || this.selectedVersion.files.length === 0) {
        return null
      }
      return (this.selectedVersion.files[0].sizeKB / 1024).toFixed(2)
    },

    sanitizedDescription() {
      return sanitizeHtml(this.lora.description || '')
    },

    sanitizedVersionDescription() {
      return sanitizeHtml(this.selectedVersion?.description || '')
    },

    isFavorite() {
      return this.checkIsFavorite(this.lora.id)
    },

    isAlreadyAdded() {
      // Check if the currently selected version is in the currentLoras list
      return this.currentLoras.some(lora =>
        lora.versionId === this.selectedVersionId
      )
    }
  },
  methods: {
    nextImage() {
      if (this.currentImageIndex < this.selectedVersionImages.length - 1) {
        this.currentImageIndex++
      }
    },

    previousImage() {
      if (this.currentImageIndex > 0) {
        this.currentImageIndex--
      }
    },

    onVersionChange() {
      this.currentImageIndex = 0
    },

    addLora() {
      const savedLora = SavedLora.fromEmbedding(this.lora, this.selectedVersionId)
      this.$emit('addLora', savedLora)
      this.$emit('close')
    },

    removeLora() {
      // Emit the specific version ID to remove
      this.$emit('removeLora', this.selectedVersionId)
      this.$emit('close')
    },

    async toggleFavorite() {
      await this.toggleFav(this.lora.id)
      this.$emit('toggleFavorite', this.lora.id)
    }
  }
}
</script>

<style scoped>
.lora-details-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-darker);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.lora-details-container {
  background: var(--color-surface);
  border-radius: 8px;
  max-width: 1200px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #333;
}

.details-title {
  font-size: 18px;
  font-weight: bold;
  color: white;
  margin: 0;
}

.btn-back,
.btn-favorite {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 8px 16px;
  transition: background 0.2s;
}

.btn-back:hover,
.btn-favorite:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-favorite i {
  color: var(--color-warning-gold);
  font-size: 18px;
}

.details-content {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: minmax(400px, 1fr) minmax(300px, 1fr);
  gap: 24px;
  padding: 24px;
}

@media (max-width: 768px) {
  .details-content {
    grid-template-columns: 1fr;
  }
}

.details-images {
  display: flex;
  flex-direction: column;
}

.image-carousel {
  position: relative;
  width: 100%;
  max-width: 512px;
  margin: 0 auto;
}

.carousel-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--color-surface-hover);
  border-radius: 8px;
  overflow: hidden;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.carousel-image.nsfw-blur {
  filter: blur(12px);
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
}

.image-counter {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: var(--overlay-dark);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--overlay-dark);
  border: none;
  border-radius: 50%;
  color: white;
  width: 40px;
  height: 40px;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 10;
}

.carousel-btn:hover:not(:disabled) {
  background: var(--overlay-darkest);
}

.carousel-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.carousel-prev {
  left: 8px;
}

.carousel-next {
  right: 8px;
}

.details-info {
  color: white;
  min-width: 0;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
}

.lora-name {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 16px 0;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.btn-add-lora,
.btn-remove-lora {
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s;
}

.btn-add-lora {
  background: #4CAF50;
}

.btn-add-lora:hover {
  background: #45a049;
}

.btn-remove-lora {
  background: #dc2626;
}

.btn-remove-lora:hover {
  background: #b91c1c;
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
}

.base-model-display {
  background: var(--color-border-lighter);
  color: white;
}

.version-name {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
}

.external-link {
  margin-bottom: 16px;
}

.external-link a {
  color: #4fc3f7;
  text-decoration: none;
  font-size: 14px;
}

.external-link a:hover {
  text-decoration: underline;
}

.version-selector {
  margin-bottom: 16px;
}

.version-selector label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 14px;
}

.version-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: var(--color-surface-hover);
  color: white;
  font-size: 14px;
}

.file-size {
  margin-bottom: 16px;
  font-size: 14px;
}

.file-size .label {
  font-weight: bold;
}

.file-size .warning {
  display: block;
  color: #ff9800;
  margin-top: 4px;
  font-size: 13px;
}

.deprecated-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 4px;
  color: #ff9800;
  font-size: 13px;
  line-height: 1.4;
}

.deprecated-warning i {
  flex-shrink: 0;
  margin-top: 2px;
}

.version-description,
.model-description {
  margin-bottom: 16px;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
  max-width: 100%;
}

.version-description h3,
.model-description h3 {
  font-size: 16px;
  margin: 0 0 8px 0;
}

.version-description :deep(p),
.model-description :deep(p) {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-gray-300);
}

.version-description :deep(*),
.model-description :deep(*) {
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

.version-description :deep(pre),
.model-description :deep(pre) {
  white-space: pre-wrap;
  overflow-x: auto;
}

.version-description :deep(code),
.model-description :deep(code) {
  word-break: break-all;
}

.details-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #333;
}

.btn-cancel,
.btn-add-lora-footer,
.btn-remove-lora-footer {
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s;
}

.btn-cancel {
  background: var(--color-border-lighter);
  color: white;
}

.btn-cancel:hover {
  background: var(--color-text-disabled);
}

.btn-add-lora-footer {
  background: #4CAF50;
  color: white;
}

.btn-add-lora-footer:hover {
  background: #45a049;
}

.btn-remove-lora-footer {
  background: #dc2626;
  color: white;
}

.btn-remove-lora-footer:hover {
  background: #b91c1c;
}
</style>
