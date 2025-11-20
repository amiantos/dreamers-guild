<template>
  <div class="lora-controls-card">
    <!-- Header -->
    <div class="lora-header">
      <span class="lora-title">{{ lora.name }}</span>
      <div class="lora-actions">
        <button
          class="btn-icon"
          @click="$emit('showInfo', lora)"
          title="Show LoRA details"
          :disabled="lora.isArtbotManualEntry"
        >
          <i class="fas fa-info-circle"></i>
        </button>
        <button
          class="btn-icon btn-danger"
          @click="$emit('remove', lora)"
          title="Remove LoRA"
        >
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>

    <!-- Version Info -->
    <div v-if="currentVersion" class="lora-version">
      <span class="label">Version:</span>
      <span class="value">{{ currentVersion.name }}</span>
    </div>

    <!-- Model Strength Control -->
    <div class="control-group">
      <label class="control-label">Model Strength</label>
      <div class="slider-container">
        <button
          class="btn-adjust"
          @click="adjustStrength(-0.05)"
          :disabled="strength <= -5.0"
        >
          <i class="fas fa-minus"></i>
        </button>

        <div class="slider-wrapper">
          <input
            type="range"
            v-model.number="strength"
            min="-5"
            max="5"
            step="0.05"
            class="slider"
            @input="updateStrength"
          />
          <input
            type="number"
            v-model.number="strength"
            min="-5"
            max="5"
            step="0.05"
            class="number-input"
            @blur="onStrengthBlur"
            @change="updateStrength"
          />
        </div>

        <button
          class="btn-adjust"
          @click="adjustStrength(0.05)"
          :disabled="strength >= 5.0"
        >
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>

    <!-- CLIP Strength Control -->
    <div class="control-group">
      <label class="control-label">CLIP Strength</label>
      <div class="slider-container">
        <button
          class="btn-adjust"
          @click="adjustClip(-0.05)"
          :disabled="clip <= -5.0"
        >
          <i class="fas fa-minus"></i>
        </button>

        <div class="slider-wrapper">
          <input
            type="range"
            v-model.number="clip"
            min="-5"
            max="5"
            step="0.05"
            class="slider"
            @input="updateClip"
          />
          <input
            type="number"
            v-model.number="clip"
            min="-5"
            max="5"
            step="0.05"
            class="number-input"
            @blur="onClipBlur"
            @change="updateClip"
          />
        </div>

        <button
          class="btn-adjust"
          @click="adjustClip(0.05)"
          :disabled="clip >= 5.0"
        >
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>

    <!-- Trigger Words -->
    <div v-if="trainedWords.length > 0" class="trigger-words">
      <span class="trigger-label">Trigger words:</span>
      <div class="trigger-chips">
        <button
          v-for="word in trainedWords"
          :key="word"
          class="trigger-chip"
          @click="$emit('addTriggerWord', word)"
          :title="`Add '${word}' to prompt`"
        >
          {{ word }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { SavedLora } from '../models/Lora'

export default {
  name: 'LoraControls',
  props: {
    lora: {
      type: Object,
      required: true
    }
  },
  emits: ['update', 'remove', 'showInfo', 'addTriggerWord'],
  data() {
    return {
      strength: this.lora.strength || 1.0,
      clip: this.lora.clip || 1.0
    }
  },
  computed: {
    currentVersion() {
      if (!this.lora.modelVersions || this.lora.modelVersions.length === 0) {
        return null
      }

      return this.lora.modelVersions.find(v => v.id === this.lora.versionId) ||
             this.lora.modelVersions[0]
    },

    trainedWords() {
      if (!this.currentVersion || !this.currentVersion.trainedWords) {
        return []
      }

      return this.currentVersion.trainedWords
    }
  },
  watch: {
    lora: {
      handler(newLora) {
        this.strength = newLora.strength || 1.0
        this.clip = newLora.clip || 1.0
      },
      deep: true
    }
  },
  methods: {
    roundToNearest005(value) {
      return Math.round(value * 20) / 20
    },

    adjustStrength(amount) {
      const newValue = this.roundToNearest005(this.strength + amount)
      if (newValue >= -5.0 && newValue <= 5.0) {
        this.strength = newValue
        this.updateStrength()
      }
    },

    adjustClip(amount) {
      const newValue = this.roundToNearest005(this.clip + amount)
      if (newValue >= -5.0 && newValue <= 5.0) {
        this.clip = newValue
        this.updateClip()
      }
    },

    updateStrength() {
      const roundedValue = this.roundToNearest005(this.strength)
      this.strength = parseFloat(roundedValue.toFixed(2))
      this.emitUpdate()
    },

    updateClip() {
      const roundedValue = this.roundToNearest005(this.clip)
      this.clip = parseFloat(roundedValue.toFixed(2))
      this.emitUpdate()
    },

    onStrengthBlur() {
      if (this.strength === '' || isNaN(this.strength)) {
        this.strength = this.lora.strength || 1.0
      } else {
        this.updateStrength()
      }
    },

    onClipBlur() {
      if (this.clip === '' || isNaN(this.clip)) {
        this.clip = this.lora.clip || 1.0
      } else {
        this.updateClip()
      }
    },

    emitUpdate() {
      const updatedLora = new SavedLora({
        ...this.lora,
        strength: this.strength,
        clip: this.clip
      })

      this.$emit('update', updatedLora)
    }
  }
}
</script>

<style scoped>
.lora-controls-card {
  background: #1d4d74;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
  color: white;
}

.lora-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.lora-title {
  font-weight: bold;
  font-size: 14px;
  font-family: monospace;
}

.lora-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 6px 10px;
  transition: background 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.8);
}

.lora-version {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.lora-version .label {
  font-weight: bold;
}

.lora-version .value {
  font-family: monospace;
}

.control-group {
  margin-bottom: 16px;
}

.control-label {
  display: block;
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 8px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-adjust {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-adjust:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn-adjust:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.slider-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.2);
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  transition: transform 0.2s;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  border: none;
  transition: transform 0.2s;
}

.slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.number-input {
  width: 70px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 13px;
  text-align: center;
}

.number-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.trigger-words {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.trigger-label {
  display: block;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
}

.trigger-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.trigger-chip {
  background: #14B8A6;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 4px 12px;
  font-size: 12px;
  transition: background 0.2s, transform 0.1s;
}

.trigger-chip:hover {
  background: #0d9488;
  transform: translateY(-1px);
}

.trigger-chip:active {
  transform: translateY(0);
}
</style>
