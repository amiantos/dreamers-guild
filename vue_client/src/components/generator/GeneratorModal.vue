<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="modal-wrapper">
        <GeneratorHeader
          @reset="resetForm"
          @close="$emit('close')"
        />

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <!-- Dynamic layout based on editor mode -->
            <component :is="currentLayout" />
          </form>
        </div>

        <GeneratorFooter
          :kudosEstimate="kudosEstimate"
          :estimateError="estimateError"
          @submit="handleSubmit"
        />

        <!-- LoRA Details Overlay -->
        <LoraDetails
          v-if="showLoraDetails"
          :lora="selectedLoraForDetails"
          :currentLoras="form.loras"
          @close="showLoraDetails = false"
          @removeLora="removeLoraFromDetails"
        />

        <!-- Textual Inversion Details Overlay -->
        <TextualInversionDetails
          v-if="showTiDetails"
          :ti="selectedTiForDetails"
          :currentTis="form.tis"
          :nsfwEnabled="settingsStore.workerPreferences?.nsfw || false"
          @close="showTiDetails = false"
          @addTi="addTi"
          @removeTi="removeTiFromDetails"
        />
      </div>
    </div>
  </div>

  <!-- Independent Modals -->
  <ModelPicker
    v-if="showModelPicker"
    :currentModel="form.model"
    @select="handleModelSelect"
    @close="showModelPicker = false"
  />

  <LoraPicker
    v-if="showLoraPicker"
    :currentLoras="form.loras"
    @add="handleAddLora"
    @close="showLoraPicker = false"
  />

  <TextualInversionPicker
    v-if="showTiPicker"
    :currentTis="form.tis"
    @add="addTi"
    @close="showTiPicker = false"
  />

  <StyleSwitchModal
    v-if="showStyleSwitchConfirm"
    @confirm="confirmSwitchToAdvanced"
    @close="showStyleSwitchConfirm = false"
  />
</template>

<script setup>
import { provide, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useGeneratorForm, GeneratorFormKey } from './composables/useGeneratorForm.js'
import { useGeneratorPersistence } from './composables/useGeneratorPersistence.js'
import { useGeneratorSubmit } from './composables/useGeneratorSubmit.js'
import { useModelCache } from '../../composables/useModelCache.js'
import { getRandomSamplePrompt } from '../../config/presets.js'

import GeneratorHeader from './GeneratorHeader.vue'
import GeneratorFooter from './GeneratorFooter.vue'
import SimpleLayout from './layouts/SimpleLayout.vue'
import AdvancedLayout from './layouts/AdvancedLayout.vue'

import ModelPicker from '../ModelPicker.vue'
import LoraPicker from '../LoraPicker.vue'
import LoraDetails from '../LoraDetails.vue'
import TextualInversionPicker from '../TextualInversionPicker.vue'
import TextualInversionDetails from '../TextualInversionDetails.vue'
import StyleSwitchModal from '../StyleSwitchModal.vue'

const props = defineProps({
  initialSettings: {
    type: Object,
    default: null
  },
  includeSeed: {
    type: Boolean,
    default: false
  },
  initialAlbumSlug: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'submit'])

// Initialize composables
const generatorForm = useGeneratorForm()
const persistence = useGeneratorPersistence(generatorForm)
const submit = useGeneratorSubmit(generatorForm, persistence)

// Destructure what we need
const {
  form,
  editorMode,
  selectedStyleName,
  selectedStyleData,
  selectedAlbumId,
  albums,
  showModelPicker,
  showLoraPicker,
  showLoraDetails,
  selectedLoraForDetails,
  showTiPicker,
  showTiDetails,
  selectedTiForDetails,
  showStyleSwitchConfirm,
  inlineStylePicker,
  onModelSelect,
  addLora,
  addTi,
  removeLoraFromDetails,
  removeTiFromDetails,
  confirmSwitchToAdvanced,
  resetFormToDefaults
} = generatorForm

const {
  loadSettings,
  loadLastUsedSettings,
  loadAlbums,
  restoreSavedAlbum,
  setupPersistenceWatchers
} = persistence

const {
  kudosEstimate,
  estimateError,
  settingsStore,
  estimateKudos,
  submitRequest,
  setupEstimationWatchers,
  cleanup
} = submit

// Model cache for fetching models
const { fetchModels, getMostPopularModel } = useModelCache()

// Provide form state to all child components
provide(GeneratorFormKey, generatorForm)

// Layout selection
const currentLayout = computed(() => {
  return editorMode.value === 'simple' ? SimpleLayout : AdvancedLayout
})

// Handlers that wrap composable methods
const handleModelSelect = (modelName) => {
  onModelSelect(modelName)
  estimateKudos()
}

const handleAddLora = (lora) => {
  addLora(lora)
  estimateKudos()
}

const handleSubmit = () => {
  submitRequest(() => {
    emit('submit')
  })
}

const resetForm = async () => {
  resetFormToDefaults()

  if (editorMode.value === 'simple') {
    // Basic mode: Apply random prompt + matching style
    const sample = getRandomSamplePrompt()
    form.prompt = sample.prompt
    selectedStyleName.value = sample.style

    // Find and set the style data from loaded styles
    if (inlineStylePicker.value) {
      const styleData = inlineStylePicker.value.getStyleByName(sample.style)
      if (styleData) {
        selectedStyleData.value = styleData
        localStorage.setItem('selectedStyle', JSON.stringify(styleData))
      }
    }
  } else {
    selectedStyleName.value = ''
    selectedStyleData.value = null
  }

  // Clear album selection
  selectedAlbumId.value = null
  localStorage.removeItem('lastUsedAlbumId')

  estimateKudos()
}

// Auto-expand textareas
const expandTextareas = async () => {
  await nextTick()
  const promptEl = document.getElementById('prompt')
  const negativePromptEl = document.getElementById('negative_prompt')
  if (promptEl) {
    promptEl.style.height = 'auto'
    promptEl.style.height = promptEl.scrollHeight + 'px'
  }
  if (negativePromptEl) {
    negativePromptEl.style.height = 'auto'
    negativePromptEl.style.height = negativePromptEl.scrollHeight + 'px'
  }
}

// Setup watchers
setupPersistenceWatchers()
setupEstimationWatchers()

// Watch for prompt changes to auto-expand
watch(
  () => [form.prompt, form.negativePrompt],
  () => expandTextareas()
)

// Lifecycle
onMounted(async () => {
  await fetchModels()
  await loadAlbums()
  restoreSavedAlbum()

  // Set default model if not already set
  if (!form.model) {
    const mostPopular = getMostPopularModel()
    if (mostPopular) {
      form.model = mostPopular.name
    }
  }

  // Load last used settings
  const hasLastUsedSettings = await loadLastUsedSettings()

  // Load initial settings from props if provided
  if (props.initialSettings) {
    await loadSettings(props.initialSettings, props.includeSeed)
    editorMode.value = 'advanced'

    // Auto-select album if user was viewing one
    if (props.initialAlbumSlug) {
      const matchingAlbum = albums.value.find(a => a.slug === props.initialAlbumSlug)
      if (matchingAlbum) {
        selectedAlbumId.value = matchingAlbum.id
      }
    }
  } else if (!hasLastUsedSettings) {
    // First time experience
    await resetForm()
  }

  // Estimate kudos if we have a model
  if (form.model) {
    estimateKudos()
  }

  // Restore saved style in Simple mode
  if (editorMode.value === 'simple' && !props.initialSettings) {
    const savedStyle = localStorage.getItem('selectedStyle')
    if (savedStyle) {
      try {
        const style = JSON.parse(savedStyle)
        selectedStyleName.value = style.name
        selectedStyleData.value = style
      } catch (e) {
        console.error('Error parsing saved style:', e)
        localStorage.removeItem('selectedStyle')
      }
    }
  }

  // Auto-expand textareas
  await expandTextareas()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-darkest);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: var(--color-surface);
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  height: 90vh;
  max-height: 90vh;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.modal-wrapper {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.modal-body {
  position: relative;
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.modal-body form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
  }

  .modal-content {
    max-width: 100%;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }

  .modal-body {
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
}
</style>
