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
              <label for="n">Images</label>
              <div class="slider-group">
                <input
                  type="range"
                  id="n"
                  v-model.number="form.n"
                  min="1"
                  max="20"
                  step="1"
                />
                <span class="range-value">{{ form.n }}</span>
              </div>
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

              <!-- Dimensions Section -->
              <div class="dimensions-section">
                <h4>Dimensions</h4>

                <div class="form-group">
                  <label for="width">Width</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="width"
                      v-model.number="form.width"
                      @input="onDimensionChange('width')"
                      min="64"
                      max="3072"
                      step="64"
                    />
                    <span class="range-value">{{ form.width }}</span>
                  </div>
                </div>

                <div class="form-group">
                  <label for="height">Height</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="height"
                      v-model.number="form.height"
                      @input="onDimensionChange('height')"
                      min="64"
                      max="3072"
                      step="64"
                    />
                    <span class="range-value">{{ form.height }}</span>
                  </div>
                </div>

                <div class="form-group">
                  <label>Aspect Ratio</label>
                  <div class="aspect-ratio-control">
                    <span class="aspect-ratio-text">{{ aspectRatioText }}</span>
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        v-model="aspectLocked"
                        @change="onAspectLockToggle"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  class="btn-swap-dimensions"
                  @click="swapDimensions"
                >
                  <span class="swap-icon">⇄</span> Swap Dimensions
                </button>
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

              <!-- Hires Fix Section -->
              <div class="form-group hires-fix-section">
                <div class="hires-fix-header">
                  <label class="toggle">
                    <input type="checkbox" v-model="form.hiresFix" />
                    <span>Hires Fix</span>
                  </label>
                </div>
                
                <div v-if="form.hiresFix" class="hires-fix-controls">
                  <label for="hires_denoise">Denoising Strength</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="hires_denoise"
                      v-model.number="form.hiresFixDenoisingStrength"
                      min="0"
                      max="1"
                      step="0.05"
                    />
                    <span class="range-value">{{ form.hiresFixDenoisingStrength }}</span>
                  </div>
                </div>
              </div>

              <!-- Face Fix Section -->
              <div class="form-group face-fix-section">
                <div class="face-fix-header">
                  <label for="face_fix">Face Fix</label>
                  <select id="face_fix" v-model="form.faceFix">
                    <option value="none">None</option>
                    <option value="GFPGAN">GFPGAN</option>
                    <option value="CodeFormers">CodeFormers</option>
                  </select>
                </div>

                <div v-if="form.faceFix !== 'none'" class="face-fix-controls">
                  <label for="face_fix_strength">Strength</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="face_fix_strength"
                      v-model.number="form.faceFixStrength"
                      min="0"
                      max="1"
                      step="0.05"
                    />
                    <span class="range-value">{{ form.faceFixStrength }}</span>
                  </div>
                </div>
              </div>

              <!-- Upscalers Section -->
              <div class="form-group">
                <label>Upscalers</label>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input type="checkbox" value="4x_AnimeSharp" v-model="form.upscalers" />
                    <span>4x AnimeSharp</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="NMKD_Siax" v-model="form.upscalers" />
                    <span>NMKD Siax</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="RealESRGAN_x2plus" v-model="form.upscalers" />
                    <span>RealESRGAN x2</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="RealESRGAN_x4plus_anime_6B" v-model="form.upscalers" />
                    <span>RealESRGAN x4 Anime</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" value="RealESRGAN_x4plus" v-model="form.upscalers" />
                    <span>RealESRGAN x4</span>
                  </label>
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
                    <input type="checkbox" v-model="form.tiling" />
                    <span>Tiling</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="form.transparent" />
                    <span>Transparent Background</span>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" v-model="form.stripBackground" />
                    <span>Strip Background</span>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { requestsApi, imagesApi, settingsApi } from '../api/client.js'
import { baseRequest, styleCopyParams } from '../config/baseRequest.js'
import { getRandomPreset } from '../config/presets.js'
import { useModelCache } from '../composables/useModelCache.js'
import { useKudosEstimation } from '../composables/useKudosEstimation.js'
import { splitPrompt, replaceNegativePlaceholder } from '../utils/promptUtils.js'
import { useSettingsStore } from '../stores/settingsStore.js'
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
    const settingsStore = useSettingsStore()
    const submitting = ref(false)
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
      hiresFixDenoisingStrength: 0.65,
      tiling: false,
      transparent: false,
      faceFix: 'none',
      faceFixStrength: 0.5,
      upscalers: [],
      stripBackground: false,
      loras: []
    })

    // Use composables
    const { models, fetchModels, getMostPopularModel } = useModelCache()
    const { kudosEstimate, estimating, estimateKudos: estimateKudosComposable } = useKudosEstimation()

    // Load worker preferences from settings store
    settingsStore.loadWorkerPreferences()

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
        const { positive, negative } = splitPrompt(settings.prompt)
        form.prompt = positive
        form.negativePrompt = negative
      } else {
        form.prompt = ''
        form.negativePrompt = ''
      }

      // Load model
      if (settings.models && settings.models.length > 0) {
        form.model = settings.models[0]
      } else {
        form.model = ''
      }

      // Load params
      if (settings.params) {
        const params = settings.params
        form.sampler = params.sampler_name !== undefined ? params.sampler_name : 'k_euler_a'
        form.cfgScale = params.cfg_scale !== undefined ? params.cfg_scale : 7
        form.height = params.height !== undefined ? params.height : 512
        form.width = params.width !== undefined ? params.width : 512
        form.karras = params.karras !== undefined ? params.karras : true
        form.hiresFix = params.hires_fix !== undefined ? params.hires_fix : false
        form.hiresFixDenoisingStrength = params.hires_fix_denoising_strength !== undefined ? params.hires_fix_denoising_strength : 0.65
        form.clipSkip = params.clip_skip !== undefined ? params.clip_skip : 1
        form.steps = params.steps !== undefined ? params.steps : 30
        form.n = params.n !== undefined ? params.n : 1
        form.tiling = params.tiling !== undefined ? params.tiling : false
        form.loras = params.loras ? [...params.loras] : []

        // Load new post-processing structure
        // Parse post_processing array to extract face fixer, upscalers, and strip_background
        if (params.post_processing && Array.isArray(params.post_processing)) {
          const pp = params.post_processing

          // Check for face fixers
          if (pp.includes('GFPGAN')) {
            form.faceFix = 'GFPGAN'
          } else if (pp.includes('CodeFormers')) {
            form.faceFix = 'CodeFormers'
          } else {
            form.faceFix = 'none'
          }

          // Load face fixer strength
          form.faceFixStrength = params.facefixer_strength !== undefined ? params.facefixer_strength : 0.5

          // Check for upscalers
          const upscalerOptions = ['4x_AnimeSharp', 'NMKD_Siax', 'RealESRGAN_x2plus', 'RealESRGAN_x4plus_anime_6B', 'RealESRGAN_x4plus']
          form.upscalers = pp.filter(item => upscalerOptions.includes(item))

          // Check for strip_background
          form.stripBackground = pp.includes('strip_background')
        } else {
          form.faceFix = 'none'
          form.faceFixStrength = 0.5
          form.upscalers = []
          form.stripBackground = false
        }

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

      // Load root-level settings
      form.transparent = settings.transparent !== undefined ? settings.transparent : false

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

        // Handle negative prompt placeholder using utility function
        generationText = replaceNegativePlaceholder(generationText, userNegativePrompt)

        // Split on ### to separate positive and negative prompts using utility function
        const { positive, negative } = splitPrompt(generationText)
        form.prompt = positive
        form.negativePrompt = negative
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
      if (style.hires_fix_denoising_strength !== undefined) form.hiresFixDenoisingStrength = style.hires_fix_denoising_strength
      if (style.tiling !== undefined) form.tiling = style.tiling
      if (style.clip_skip !== undefined) form.clipSkip = style.clip_skip
      if (style.loras && Array.isArray(style.loras)) {
        form.loras = [...style.loras]
      } else {
        form.loras = []
      }

      // Clear post-processing options when style is applied
      form.faceFix = 'none'
      form.faceFixStrength = 0.5
      form.upscalers = []
      form.stripBackground = false

      // Deselect the style (set back to None)
      selectedStyleName.value = 'None'
      selectedStyleData.value = null

      estimateKudos()
    }

    // Calculate GCD for aspect ratio simplification
    const gcd = (a, b) => {
      return b === 0 ? a : gcd(b, a % b)
    }

    // Computed property for aspect ratio text
    const aspectRatioText = computed(() => {
      const divisor = gcd(form.width, form.height)
      const widthRatio = form.width / divisor
      const heightRatio = form.height / divisor
      return `Lock to ${widthRatio}:${heightRatio}`
    })

    const onAspectLockToggle = () => {
      if (aspectLocked.value) {
        // Just turned on the lock, save the current ratio
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

    const swapDimensions = () => {
      const temp = form.width
      form.width = form.height
      form.height = temp
      // Update aspect ratio if locked
      if (aspectLocked.value) {
        aspectRatio.value = form.width / form.height
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

      // Apply user preferences (AI Horde settings) from settings store
      params.nsfw = settingsStore.workerPreferences.nsfw
      params.trusted_workers = settingsStore.workerPreferences.trustedWorkers
      params.slow_workers = settingsStore.workerPreferences.slowWorkers
      params.allow_downgrade = settingsStore.workerPreferences.allowDowngrade
      params.replacement_filter = settingsStore.workerPreferences.replacementFilter
      
      // Add transparent flag if enabled
      if (form.transparent) {
        params.transparent = true
      }

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
        if (form.hiresFix) {
          params.params.hires_fix_denoising_strength = form.hiresFixDenoisingStrength
        }
        params.params.tiling = form.tiling
        params.params.clip_skip = form.clipSkip

        // Add seed if not using random
        if (!form.useRandomSeed && form.seed) {
          params.params.seed = form.seed
        }

        // Build post-processing array in correct order:
        // 1. Face fixer (if selected)
        // 2. Upscalers (all selected)
        // 3. Strip background (if enabled, must be last)
        const postProcessing = []

        // Add face fixer first
        if (form.faceFix !== 'none') {
          postProcessing.push(form.faceFix)
          // Add face fixer strength parameter
          params.params.facefixer_strength = form.faceFixStrength
        }

        // Add upscalers
        if (form.upscalers && form.upscalers.length > 0) {
          postProcessing.push(...form.upscalers)
        }

        // Add strip_background last
        if (form.stripBackground) {
          postProcessing.push('strip_background')
        }

        // Only add post_processing if there's something to process
        if (postProcessing.length > 0) {
          params.params.post_processing = postProcessing
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
        return
      }

      const params = buildRequestParams()
      await estimateKudosComposable(params)
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

      // Set default model if not already set
      if (!form.model) {
        const mostPopular = getMostPopularModel()
        if (mostPopular) {
          form.model = mostPopular.name
        }
      }

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
      aspectRatioText,
      selectedStyleName,
      selectedStyleData,
      submitRequest,
      onModelSelect,
      onStyleSelect,
      applyStyle,
      onAspectLockToggle,
      onDimensionChange,
      swapDimensions,
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

.hires-fix-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.hires-fix-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.hires-fix-controls {
  margin-top: 1rem;
  padding-left: 0.5rem;
}

.face-fix-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.face-fix-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.face-fix-controls {
  margin-top: 1rem;
  padding-left: 0.5rem;
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
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: #333;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

/* WebKit browsers (Chrome, Safari, Edge) */
.slider-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #007AFF;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slider-group input[type="range"]::-webkit-slider-thumb:hover {
  background: #0051D5;
  transform: scale(1.1);
}

/* Firefox */
.slider-group input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #007AFF;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slider-group input[type="range"]::-moz-range-thumb:hover {
  background: #0051D5;
  transform: scale(1.1);
}

.slider-group input[type="range"]::-moz-range-track {
  background: #333;
  height: 6px;
  border-radius: 3px;
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

/* Dimensions Section */
.dimensions-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.dimensions-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #999;
  letter-spacing: 0.05em;
}

/* Aspect Ratio Control */
.aspect-ratio-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
}

.aspect-ratio-text {
  color: #fff;
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
  background-color: #34c759;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Swap Dimensions Button */
.btn-swap-dimensions {
  width: 100%;
  padding: 0.75rem;
  margin-top: 1rem;
  background: linear-gradient(180deg, #5e5ce6 0%, #4a4acf 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-swap-dimensions:hover {
  background: linear-gradient(180deg, #4a4acf 0%, #3838b8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(94, 92, 230, 0.3);
}

.btn-swap-dimensions:active {
  transform: translateY(0);
}

.swap-icon {
  font-size: 1.2rem;
  font-weight: bold;
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
