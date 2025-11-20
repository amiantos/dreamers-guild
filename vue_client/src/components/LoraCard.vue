<template>
  <div
    class="lora-card"
    @click="$emit('click', lora)"
    :style="cardStyle"
  >
    <!-- Preview Image -->
    <div class="lora-image-container">
      <img
        v-if="previewImage"
        :src="previewImage.url"
        :alt="lora.name"
        :class="{'nsfw-blur': shouldBlur}"
        class="lora-image"
        loading="lazy"
      />
      <div v-else class="lora-image-placeholder">
        <span>No Preview</span>
      </div>
    </div>

    <!-- Base Model Badge -->
    <div v-if="baseModel" class="base-model-badge">
      <i class="fas fa-cube"></i>
      <span>{{ baseModel }}</span>
    </div>

    <!-- LoRA Name -->
    <div class="lora-name-overlay">
      <div class="lora-name-bg"></div>
      <div class="lora-name">{{ lora.name }}</div>
    </div>

    <!-- Favorite Star -->
    <button
      class="favorite-button"
      @click.stop="$emit('toggleFavorite', lora.id)"
      :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
    >
      <i :class="isFavorite ? 'fas fa-star' : 'far fa-star'"></i>
    </button>
  </div>
</template>

<script>
export default {
  name: 'LoraCard',
  props: {
    lora: {
      type: Object,
      required: true
    },
    isFavorite: {
      type: Boolean,
      default: false
    },
    nsfwEnabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click', 'toggleFavorite'],
  computed: {
    previewImage() {
      if (!this.lora.modelVersions || this.lora.modelVersions.length === 0) {
        return null
      }

      const firstVersion = this.lora.modelVersions[0]
      if (!firstVersion.images || firstVersion.images.length === 0) {
        return null
      }

      return firstVersion.images[0]
    },

    baseModel() {
      if (!this.lora.modelVersions || this.lora.modelVersions.length === 0) {
        return ''
      }

      return this.lora.modelVersions[0].baseModel || ''
    },

    shouldBlur() {
      if (this.nsfwEnabled) return false
      if (!this.previewImage) return false

      return (this.previewImage.nsfwLevel || 0) >= 7
    },

    cardStyle() {
      // Maintain 4:5 aspect ratio
      return {
        aspectRatio: '4 / 5'
      }
    }
  }
}
</script>

<style scoped>
.lora-card {
  position: relative;
  width: 100%;
  max-width: 320px;
  max-height: 400px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: #2a2a2a;
}

.lora-card:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.lora-image-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.lora-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.lora-image.nsfw-blur {
  filter: blur(12px);
}

.lora-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: bold;
}

.base-model-badge {
  position: absolute;
  bottom: 64px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  font-size: 12px;
  font-weight: bold;
  height: 24px;
}

.lora-name-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
}

.lora-name-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: black;
  opacity: 0.4;
  z-index: 1;
}

.lora-name {
  position: relative;
  z-index: 10;
  color: white;
  font-weight: bold;
  font-size: 12px;
  line-height: 1.2;
  backdrop-filter: blur(10px);
  word-wrap: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.favorite-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #ffd700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, background 0.2s ease;
  z-index: 20;
}

.favorite-button:hover {
  transform: scale(1.1);
  background: rgba(0, 0, 0, 0.8);
}

.favorite-button i {
  font-size: 16px;
}
</style>
