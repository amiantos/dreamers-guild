<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="modal-wrapper" v-show="!showModelPicker && !showStylePicker">
        <div class="modal-header">
          <h2>New Image Request</h2>
          <div class="header-actions">
            <button class="btn-reset" @click="loadRandomPreset" title="Load random preset">
              Reset
            </button>
            <button class="btn-close" @click="$emit('close')">×</button>
          </div>
        </div>

        <div class="modal-body">
          <form @submit.prevent="submitRequest">
            <!-- Prompt Section (Always Visible) -->
            <div class="form-group">
              <label for="prompt">Prompt *</label>
              <textarea
                id="prompt"
                v-model="form.prompt"
                placeholder="Describe the image you want to generate..."
                rows="4"
                required
              ></textarea>
            </div>

            <div class="form-group">
              <label for="negative_prompt">Negative Prompt</label>
              <textarea
                id="negative_prompt"
                v-model="form.negativePrompt"
                placeholder="Things to avoid in the image..."
                rows="2"
              ></textarea>
            </div>

            <!-- Number of Images (Always Visible) -->
            <div class="form-group">
              <label for="n">Number of Images</label>
              <input
                type="number"
                id="n"
                v-model.number="form.n"
                min="1"
                max="10"
              />
            </div>

            <!-- Style Selection (Always Visible) -->
            <div class="form-group">
              <label>Style</label>
              <div class="selector-button" @click="showStylePicker = true">
                <span class="selector-value">{{ selectedStyleName }}</span>
                <span class="selector-arrow">›</span>
              </div>
            </div>

            <!-- Apply Style Button (When Style is Selected) -->
            <div v-if="selectedStyleName !== 'None'" class="style-actions">
              <button
                type="button"
                @click="applyStyle"
                class="btn btn-apply-style"
              >
                Apply Style
              </button>
            </div>

            <!-- Full Parameters (Only Visible When NO Style is Selected) -->
            <div v-if="selectedStyleName === 'None'" class="full-parameters">
              <!-- Model Selection -->
              <div class="form-group">
                <label>Model</label>
                <div class="selector-button" @click="showModelPicker = true">
                  <span class="selector-value">{{ form.model || 'Loading...' }}</span>
                  <span class="selector-arrow">›</span>
                </div>
              </div>

              <!-- Steps -->
              <div class="form-group">
                <label for="steps">Steps</label>
                <input
                  type="number"
                  id="steps"
                  v-model.number="form.steps"
                  min="1"
                  max="100"
                />
              </div>

              <!-- Dimensions with Aspect Ratio Lock -->
              <div class="form-row three-col">
                <div class="form-group">
                  <label for="width">Width</label>
                  <input
                    type="number"
                    id="width"
                    v-model.number="form.width"
                    @input="onDimensionChange('width')"
                    min="256"
                    max="2048"
                    step="64"
                  />
                </div>

                <div class="form-group">
                  <label>
                    <button
                      type="button"
                      class="btn-aspect-lock"
                      @click="toggleAspectLock"
                      :title="aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'"
                    >
                      {{ aspectLocked ? '🔒' : '🔓' }}
                    </button>
                  </label>
                </div>

                <div class="form-group">
                  <label for="height">Height</label>
                  <input
                    type="number"
                    id="height"
                    v-model.number="form.height"
                    @input="onDimensionChange('height')"
                    min="256"
                    max="2048"
                    step="64"
                  />
                </div>
              </div>

              <!-- CFG Scale and Clip Skip -->
              <div class="form-row">
                <div class="form-group">
                  <label for="cfg_scale">CFG Scale</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="cfg_scale"
                      v-model.number="form.cfgScale"
                      min="1"
                      max="30"
                      step="0.5"
                    />
                    <span class="range-value">{{ form.cfgScale }}</span>
                  </div>
                </div>

                <div class="form-group">
                  <label for="clip_skip">Clip Skip</label>
                  <input
                    type="number"
                    id="clip_skip"
                    v-model.number="form.clipSkip"
                    min="1"
                    max="12"
                  />
                </div>
              </div>

              <!-- Sampler -->
              <div class="form-group">
                <label for="sampler">Sampler</label>
                <select id="sampler" v-model="form.sampler">
                  <option value="k_euler">Euler</option>
                  <option value="k_euler_a">Euler a</option>
                  <option value="k_dpm_2">DPM 2</option>
                  <option value="k_dpm_2_a">DPM 2 a</option>
                  <option value="k_heun">Heun</option>
                  <option value="k_dpm_fast">DPM fast</option>
                  <option value="k_dpm_adaptive">DPM adaptive</option>
                  <option value="k_lms">LMS</option>
                  <option value="ddim">DDIM</option>
                  <option value="k_dpmpp_2m">DPM++ 2M</option>
                  <option value="k_dpmpp_2s_a">DPM++ 2S a</option>
                  <option value="k_dpmpp_sde">DPM++ SDE</option>
                </select>
              </div>

              <!-- Seed -->
              <div class="form-group">
                <label for="seed">Seed</label>
                <div class="seed-control">
                  <label class="seed-toggle">
                    <input type="checkbox" v-model="form.useRandomSeed" />
                    <span>Random</span>
                  </label>
                  <input
                    v-if="!form.useRandomSeed"
                    type="text"
                    id="seed"
                    v-model="form.seed"
                    placeholder="Enter seed number"
                    class="seed-input"
                  />
                </div>
              </div>

              <!-- Advanced Toggles -->
              <div class="toggles-section">
                <h4>Advanced Options</h4>
                <div class="toggle-grid">
                  <label class="toggle">
                    <input type="checkbox" v-model="form.karras" />
                    <span>Karras</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="form.hiresFix" />
                    <span>Hires Fix</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="form.tiling" />
                    <span>Tiling</span>
                  </label>
                </div>
              </div>

              <!-- Post-Processing -->
              <div class="form-group">
                <label>Post-Processing</label>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input type="checkbox" value="GFPGAN" v-model="form.postProcessing" />
                    <span>GFPGAN (Face Fix)</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="CodeFormers" v-model="form.postProcessing" />
                    <span>CodeFormers (Face Fix)</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="RealESRGAN_x2plus" v-model="form.postProcessing" />
                    <span>RealESRGAN x2</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="RealESRGAN_x4plus" v-model="form.postProcessing" />
                    <span>RealESRGAN x4</span>
                  </label>
                </div>
              </div>
            </div>
          </form>
        </div>

        <!-- Modal Footer (Static at bottom) -->
        <div class="modal-footer">
          <!-- Kudos Estimate -->
          <div class="kudos-estimate" v-if="kudosEstimate !== null">
            <span class="kudos-label">Estimated Cost:</span>
            <span class="kudos-value">{{ kudosEstimate.toLocaleString() }} kudos</span>
            <button type="button" @click="estimateKudos" class="btn-refresh" :disabled="estimating">
              ↻
            </button>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button type="button" @click="$emit('close')" class="btn btn-cancel">
              Cancel
            </button>
            <button type="submit" @click="submitRequest" class="btn btn-submit" :disabled="submitting">
              {{ submitting ? 'Submitting...' : 'Generate' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Model Picker Slide-in -->
      <ModelPicker
        v-if="showModelPicker"
        :currentModel="form.model"
        @select="onModelSelect"
        @close="showModelPicker = false"
      />

      <!-- Style Picker Slide-in -->
      <StylePicker
        v-if="showStylePicker"
        :currentStyle="selectedStyleName"
        @select="onStyleSelect"
        @close="showStylePicker = false"
      />
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch } from 'vue'
import { requestsApi, imagesApi, settingsApi } from '../api/client.js'
import { baseRequest, styleCopyParams } from '../config/baseRequest.js'
import { getRandomPreset } from '../config/presets.js'
import axios from 'axios'
import ModelPicker from './ModelPicker.vue'
import StylePicker from './StylePicker.vue'

export default {
  name: 'RequestGeneratorModal',
  components: {
    ModelPicker,
    StylePicker
  },
  props: {
    initialSettings: {
      type: Object,
      default: null
    },
    includeSeed: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'submit'],
  setup(props, { emit }) {
    const submitting = ref(false)
    const estimating = ref(false)
    const kudosEstimate = ref(null)
    const showModelPicker = ref(false)
    const showStylePicker = ref(false)
    const aspectLocked = ref(false)
    const aspectRatio = ref(1)
    const selectedStyleName = ref('None')
    const selectedStyleData = ref(null)

    const form = reactive({
      prompt: '',
      negativePrompt: '',
      model: '',
      n: 1,
      steps: 30,
      width: 512,
      height: 512,
      cfgScale: 7,
      clipSkip: 1,
      sampler: 'k_euler_a',
      seed: '',
      useRandomSeed: true,
      karras: true,
      hiresFix: false,
      tiling: false,
      postProcessing: [],
      loras: []
    })

    // Load worker preferences from localStorage
    const getWorkerPreferences = () => {
      try {
        const savedPrefs = localStorage.getItem('workerPreferences')
        if (savedPrefs) {
          return JSON.parse(savedPrefs)
        }
      } catch (error) {
        console.error('Error loading worker preferences:', error)
      }
      // Default preferences
      return {
        slowWorkers: true,
        trustedWorkers: false,
        nsfw: false
      }
    }


    // Fetch available models from AI Horde (with caching)
    const fetchModels = async (forceRefresh = false) => {
      try {
        const cacheKey = 'aiHordeModels'
        const cacheTimeKey = 'aiHordeModelsTime'
        const cacheMaxAge = 60 * 60 * 1000 // 1 hour in milliseconds

        // Check cache first unless force refresh
        if (!forceRefresh) {
          const cachedModels = localStorage.getItem(cacheKey)
          const cachedTime = localStorage.getItem(cacheTimeKey)

          if (cachedModels && cachedTime) {
            const age = Date.now() - parseInt(cachedTime)
            if (age < cacheMaxAge) {
              // Use cached models
              try {
                const models = JSON.parse(cachedModels)
                if (models.length > 0 && !form.model) {
                  form.model = models[0].name
                }
                return
              } catch (parseError) {
                console.error('Error parsing cached models:', parseError)
                // Fall through to fetch from server
              }
            }
          }
        }

        // Fetch from server
        const response = await axios.get('https://stablehorde.net/api/v2/status/models')
        const models = response.data
          .filter(model => model.type === 'image' && model.count > 0)
          .sort((a, b) => b.count - a.count)

        // Cache the models
        localStorage.setItem(cacheKey, JSON.stringify(models))
        localStorage.setItem(cacheTimeKey, Date.now().toString())

        // Set default to most popular model
        if (models.length > 0 && !form.model) {
          form.model = models[0].name
        }
      } catch (error) {
        console.error('Error fetching models:', error)
      }
    }

    // Load last used settings (from localStorage for speed, fallback to server)
    const loadLastUsedSettings = async () => {
      try {
        // Try localStorage first for instant loading
        const cachedSettings = localStorage.getItem('lastUsedSettings')
        if (cachedSettings) {
          try {
            const lastSettings = JSON.parse(cachedSettings)
            if (lastSettings && typeof lastSettings === 'object') {
              Object.assign(form, lastSettings)
              return // Success, no need to fetch from server
            }
          } catch (parseError) {
            console.error('Error parsing cached settings:', parseError)
            // Fall through to server fetch
          }
        }

        // Fallback to server if no cache or cache failed
        const response = await settingsApi.get()
        if (response.data && response.data.last_used_settings) {
          try {
            const lastSettings = JSON.parse(response.data.last_used_settings)
            if (lastSettings && typeof lastSettings === 'object') {
              Object.assign(form, lastSettings)
              // Cache the settings locally for next time
              localStorage.setItem('lastUsedSettings', JSON.stringify(lastSettings))
            }
          } catch (parseError) {
            console.error('Error parsing last_used_settings:', parseError)
          }
        }
      } catch (error) {
        console.error('Error loading last used settings:', error)
      }
    }

    // Save last used settings (to both localStorage and server)
    const saveLastUsedSettings = async () => {
      try {
        const settingsToSave = { ...form }
        // Don't save loras in last used settings as they're style-specific
        delete settingsToSave.loras
        // Don't save worker preferences (they're now stored separately in settings)

        // Save to localStorage immediately for instant access
        localStorage.setItem('lastUsedSettings', JSON.stringify(settingsToSave))

        // Also save to server (async, don't wait)
        settingsApi.update({ lastUsedSettings: settingsToSave }).catch(error => {
          console.error('Error saving settings to server:', error)
        })
      } catch (error) {
        console.error('Error saving last used settings:', error)
      }
    }

    const onModelSelect = (modelName) => {
      form.model = modelName
      estimateKudos()
    }

    const onStyleSelect = (style) => {
      selectedStyleName.value = style.name
      selectedStyleData.value = style.name === 'None' ? null : style
    }

    // Load settings from an arbitrary settings object
    const loadSettings = (settings, includeSeed = false) => {
      // Split prompt on ### to separate positive and negative prompts
      if (settings.prompt) {
        const splitPrompt = settings.prompt.split('###')
        if (splitPrompt.length > 0) {
          form.prompt = splitPrompt[0].trim()
        }
        if (splitPrompt.length > 1 && splitPrompt[0] !== splitPrompt[splitPrompt.length - 1]) {
          form.negativePrompt = splitPrompt[splitPrompt.length - 1].trim()
        } else {
          form.negativePrompt = ''
        }
      }

      // Load model
      if (settings.models && settings.models.length > 0) {
        form.model = settings.models[0]
      }

      // Load params
      if (settings.params) {
        const params = settings.params
        if (params.sampler_name) form.sampler = params.sampler_name
        if (params.cfg_scale !== undefined) form.cfgScale = params.cfg_scale
        if (params.height !== undefined) form.height = params.height
        if (params.width !== undefined) form.width = params.width
        if (params.karras !== undefined) form.karras = params.karras
        if (params.hires_fix !== undefined) form.hiresFix = params.hires_fix
        if (params.clip_skip !== undefined) form.clipSkip = params.clip_skip
        if (params.steps !== undefined) form.steps = params.steps
        if (params.n !== undefined) form.n = params.n
        if (params.tiling !== undefined) form.tiling = params.tiling
        if (params.loras) form.loras = [...params.loras]
        if (params.post_processing) form.postProcessing = [...params.post_processing]

        // Load seed if requested and available
        if (includeSeed && params.seed !== undefined && params.seed !== null && params.seed !== '') {
          form.seed = String(params.seed)
          form.useRandomSeed = false
          // Set number of images to 1 when loading with seed
          form.n = 1
        } else {
          form.seed = ''
          form.useRandomSeed = true
        }
      }

      // Clear any selected style
      selectedStyleName.value = 'None'
      selectedStyleData.value = null

      // Re-estimate kudos
      estimateKudos()
    }

    const loadRandomPreset = () => {
      const preset = getRandomPreset()
      loadSettings(preset)
    }

    const applyStyle = () => {
      if (!selectedStyleData.value || selectedStyleData.value.name === 'None') {
        return
      }

      const style = selectedStyleData.value

      // Apply style's prompt template to the actual form prompts
      if (style.prompt) {
        const userPrompt = form.prompt || ''
        const userNegativePrompt = form.negativePrompt || ''

        // Replace {p} with user's positive prompt
        let generationText = style.prompt.replace(/{p}/g, userPrompt)

        // Handle negative prompt placeholder
        if (userNegativePrompt === '') {
          // If negative prompt is empty, remove {np} placeholders
          generationText = generationText.replace(/{np},/g, '')
          generationText = generationText.replace(/{np}/g, '')
        } else if (generationText.includes('###')) {
          // If template already has ###, replace {np} with negative prompt
          generationText = generationText.replace(/{np}/g, userNegativePrompt)
        } else {
          // Otherwise, replace {np} with ### separator + negative prompt
          generationText = generationText.replace(/{np}/g, ` ### ${userNegativePrompt}`)
        }

        // Split on ### to separate positive and negative prompts
        const splitPrompt = generationText.split('###')
        if (splitPrompt.length > 0) {
          form.prompt = splitPrompt[0].trim()
        }
        if (splitPrompt.length > 1 && splitPrompt[0] !== splitPrompt[splitPrompt.length - 1]) {
          form.negativePrompt = splitPrompt[splitPrompt.length - 1].trim()
        } else {
          form.negativePrompt = ''
        }
      }

      // Apply all style parameters to form
      if (style.model) form.model = style.model
      if (style.steps !== undefined) form.steps = style.steps
      if (style.width !== undefined) form.width = style.width
      if (style.height !== undefined) form.height = style.height
      if (style.cfg_scale !== undefined) form.cfgScale = style.cfg_scale
      if (style.sampler_name) form.sampler = style.sampler_name
      if (style.karras !== undefined) form.karras = style.karras
      if (style.hires_fix !== undefined) form.hiresFix = style.hires_fix
      if (style.tiling !== undefined) form.tiling = style.tiling
      if (style.clip_skip !== undefined) form.clipSkip = style.clip_skip
      if (style.loras && Array.isArray(style.loras)) {
        form.loras = [...style.loras]
      } else {
        form.loras = []
      }

      // Clear post-processing when style is applied
      form.postProcessing = []

      // Deselect the style (set back to None)
      selectedStyleName.value = 'None'
      selectedStyleData.value = null

      estimateKudos()
    }

    const toggleAspectLock = () => {
      aspectLocked.value = !aspectLocked.value
      if (aspectLocked.value) {
        aspectRatio.value = form.width / form.height
      }
    }

    const onDimensionChange = (dimension) => {
      if (!aspectLocked.value) return

      if (dimension === 'width') {
        form.height = Math.round(form.width / aspectRatio.value / 64) * 64
      } else {
        form.width = Math.round(form.height * aspectRatio.value / 64) * 64
      }
    }

    const buildPromptWithStyle = () => {
      // If no style is selected or no style data, return prompts as-is
      if (selectedStyleName.value === 'None' || !selectedStyleData.value || !selectedStyleData.value.prompt) {
        // Combine prompt and negative prompt with ### separator if both exist
        if (form.prompt && form.negativePrompt) {
          return {
            prompt: `${form.prompt} ### ${form.negativePrompt}`,
            negativePrompt: null
          }
        }
        return {
          prompt: form.prompt,
          negativePrompt: form.negativePrompt || null
        }
      }

      const stylePromptTemplate = selectedStyleData.value.prompt
      const userPrompt = form.prompt || ''
      const userNegativePrompt = form.negativePrompt || ''

      // Replace {p} with user's positive prompt
      let generationText = stylePromptTemplate.replace(/{p}/g, userPrompt)

      // Handle negative prompt placeholder (same logic as iOS)
      if (userNegativePrompt === '') {
        // If negative prompt is empty, remove {np} placeholders
        generationText = generationText.replace(/{np},/g, '')
        generationText = generationText.replace(/{np}/g, '')
      } else if (generationText.includes('###')) {
        // If template already has ###, replace {np} with negative prompt
        generationText = generationText.replace(/{np}/g, userNegativePrompt)
      } else {
        // Otherwise, replace {np} with ### separator + negative prompt
        generationText = generationText.replace(/{np}/g, ` ### ${userNegativePrompt}`)
      }

      // Return the combined prompt (API will handle splitting on ###)
      return {
        prompt: generationText,
        negativePrompt: null
      }
    }

    const buildRequestParams = () => {
      const { prompt: finalPrompt, negativePrompt: finalNegativePrompt } = buildPromptWithStyle()

      // Start with baseRequest as foundation
      const params = JSON.parse(JSON.stringify(baseRequest))

      // Apply prompt
      params.prompt = finalPrompt

      // Set model
      params.models = [form.model]

      // Apply user preferences (worker settings) from settings
      const workerPrefs = getWorkerPreferences()
      params.nsfw = workerPrefs.nsfw
      params.trusted_workers = workerPrefs.trustedWorkers
      params.slow_workers = workerPrefs.slowWorkers

      // If a style is selected, apply style parameters on top of baseRequest
      if (selectedStyleName.value !== 'None' && selectedStyleData.value) {
        const style = selectedStyleData.value

        // Copy style parameters to request
        styleCopyParams.forEach(param => {
          if (style[param] !== undefined) {
            params.params[param] = style[param]
          }
        })

        // Style model overrides form model
        if (style.model) {
          params.models = [style.model]
        }
      } else {
        // No style selected, use user's custom settings
        params.params.n = form.n
        params.params.steps = form.steps
        params.params.width = form.width
        params.params.height = form.height
        params.params.cfg_scale = form.cfgScale
        params.params.sampler_name = form.sampler
        params.params.karras = form.karras
        params.params.hires_fix = form.hiresFix
        params.params.tiling = form.tiling
        params.params.clip_skip = form.clipSkip

        // Add seed if not using random
        if (!form.useRandomSeed && form.seed) {
          params.params.seed = form.seed
        }

        // Add post-processing if any
        if (form.postProcessing.length > 0) {
          params.params.post_processing = form.postProcessing
        }

        // Add loras if any
        if (form.loras && form.loras.length > 0) {
          params.params.loras = form.loras
        }
      }

      // User's image quantity always overrides (even with style)
      params.params.n = form.n

      // Add negative prompt if it exists
      if (finalNegativePrompt) {
        params.params.negative_prompt = finalNegativePrompt
      }

      return params
    }

    const estimateKudos = async () => {
      // Don't estimate without a model - will fail
      if (!form.model) {
        kudosEstimate.value = null
        return
      }

      try {
        estimating.value = true
        const params = buildRequestParams()

        // Use placeholder prompt if user hasn't entered one yet
        if (!params.prompt || params.prompt.trim().length === 0) {
          params.prompt = 'placeholder prompt for estimation'
        }

        // Remove negative prompt for estimation if it's empty
        if (params.params.negative_prompt && !params.params.negative_prompt.trim()) {
          delete params.params.negative_prompt
        }

        const response = await imagesApi.estimate(params)
        kudosEstimate.value = response.data.kudos
      } catch (error) {
        console.error('Error estimating kudos:', error)
        kudosEstimate.value = null
      } finally {
        estimating.value = false
      }
    }

    const submitRequest = async () => {
      try {
        submitting.value = true

        const params = buildRequestParams()

        await requestsApi.create({
          prompt: form.prompt,
          params
        })

        // Save settings for next time
        await saveLastUsedSettings()

        emit('submit')
      } catch (error) {
        console.error('Error submitting request:', error)
        alert('Failed to submit request. Please try again.')
      } finally {
        submitting.value = false
      }
    }

    // Auto-estimate kudos when key parameters change
    watch(
      () => [form.model, form.n, form.steps, form.width, form.height, selectedStyleName.value],
      () => {
        if (form.model) {
          estimateKudos()
        }
      }
    )

    onMounted(async () => {
      await fetchModels()

      // Always load last used settings first to restore worker preferences
      await loadLastUsedSettings()

      // Then load initial settings from props if provided (this will override generation params but not worker prefs)
      if (props.initialSettings) {
        loadSettings(props.initialSettings, props.includeSeed)
      }

      // Only estimate if we have a model after loading
      if (form.model) {
        estimateKudos()
      }
    })

    return {
      form,
      submitting,
      estimating,
      kudosEstimate,
      showModelPicker,
      showStylePicker,
      aspectLocked,
      selectedStyleName,
      selectedStyleData,
      submitRequest,
      onModelSelect,
      onStyleSelect,
      applyStyle,
      toggleAspectLock,
      onDimensionChange,
      estimateKudos,
      loadSettings,
      loadRandomPreset,
      fetchModels
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: #1a1a1a;
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

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  background: #1a1a1a;
  z-index: 1;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-reset {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #333;
  border-radius: 6px;
  color: #999;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: #2a2a2a;
  color: #fff;
  border-color: #007AFF;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.modal-footer {
  flex-shrink: 0;
  padding: 1.5rem;
  border-top: 1px solid #333;
  background: #1a1a1a;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #999;
  font-size: 0.9rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
  font-family: inherit;
}

.form-group textarea {
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #007AFF;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.form-row.three-col {
  grid-template-columns: 1fr auto 1fr;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-group input[type="range"] {
  flex: 1;
  width: auto;
}

.range-value {
  display: inline-block;
  min-width: 50px;
  text-align: center;
  padding: 0.5rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 0.875rem;
}

.selector-button {
  width: 100%;
  padding: 0.75rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-button:hover {
  background: #252525;
  border-color: #444;
}

.selector-value {
  flex: 1;
  text-align: left;
}

.selector-arrow {
  color: #999;
  font-size: 1.5rem;
  font-weight: 300;
}

.style-actions {
  margin-bottom: 1.5rem;
}

.btn-apply-style,
.btn-remove-style {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-apply-style {
  background: #007AFF;
  color: white;
}

.btn-apply-style:hover {
  background: #0051D5;
}

.btn-remove-style {
  background: #ff3b30;
  color: white;
}

.btn-remove-style:hover {
  background: #cc2e24;
}

.btn-aspect-lock {
  background: transparent;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1.8rem;
}

.btn-aspect-lock:hover {
  background: #252525;
  border-color: #007AFF;
}

.toggles-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
}

.toggles-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #999;
  letter-spacing: 0.05em;
}

.toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.toggle:hover {
  background: #252525;
}

.toggle input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.toggle span {
  color: #fff;
  font-size: 0.9rem;
}

.full-parameters {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #333;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

.checkbox-item input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.checkbox-item span {
  color: #fff;
  font-size: 0.9rem;
}

.seed-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.seed-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
  white-space: nowrap;
}

.seed-toggle:hover {
  background: #252525;
}

.seed-toggle input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.seed-toggle span {
  color: #fff;
  font-size: 0.9rem;
}

.seed-input {
  flex: 1;
}

.kudos-estimate {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 6px;
  margin-bottom: 1rem;
}

.kudos-label {
  color: #999;
  font-size: 0.9rem;
}

.kudos-value {
  color: #007AFF;
  font-weight: 600;
  font-size: 1.125rem;
  flex: 1;
}

.btn-refresh {
  background: transparent;
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 6px;
  color: #007AFF;
  font-size: 1.25rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.2);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  color: #999;
  border: 1px solid #333;
}

.btn-cancel:hover {
  background: #2a2a2a;
  color: #fff;
}

.btn-submit {
  background: #007AFF;
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #0051D5;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
