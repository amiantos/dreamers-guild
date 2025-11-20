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
            <!-- Basic Settings Section (Always Visible) -->
            <h4 class="section-title">Basic Settings</h4>
            <div class="basic-settings-section">
              <div class="form-group">
                <label for="prompt">Prompt *</label>
                <textarea
                  id="prompt"
                  ref="promptTextarea"
                  v-model="form.prompt"
                  @input="autoExpand"
                  placeholder="Describe the image you want to generate..."
                  rows="4"
                  required
                ></textarea>
              </div>

              <div class="form-group">
                <label for="negative_prompt">Negative Prompt</label>
                <textarea
                  id="negative_prompt"
                  ref="negativePromptTextarea"
                  v-model="form.negativePrompt"
                  @input="autoExpand"
                  placeholder="Things to avoid in the image..."
                  rows="2"
                ></textarea>
              </div>

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
            </div>

            <!-- Full Parameters (Only Visible When NO Style is Selected) -->
            <div v-if="selectedStyleName === 'None'" class="full-parameters">
              <!-- Dimensions Section -->
              <h4 class="section-title">Dimensions</h4>
              <div class="dimensions-section">
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

                  <button
                    type="button"
                    class="btn-swap-dimensions"
                    @click="swapDimensions"
                  >
                    <span class="swap-icon">⇄</span> Swap Dimensions
                  </button>
                </div>
              </div>

              <!-- Generation Settings Section -->
              <h4 class="section-title">Advanced Generation Settings</h4>
              <div class="generation-settings-section">
                <div class="form-group">
                  <label>Model</label>
                  <div class="selector-button" @click="showModelPicker = true">
                    <span class="selector-value">{{ form.model || 'Loading...' }}</span>
                    <span class="selector-arrow">›</span>
                  </div>
                </div>

                <div class="form-group">
                  <label>Sampler</label>
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

                <div class="form-group">
                  <label for="steps">Steps</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="steps"
                      v-model.number="form.steps"
                      min="1"
                      max="150"
                      step="1"
                    />
                    <span class="range-value">{{ form.steps }}</span>
                  </div>
                </div>

                <div class="form-group">
                  <label for="cfg_scale">Guidance</label>
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
                  <label for="clip_skip">CLIP Skip</label>
                  <div class="slider-group">
                    <input
                      type="range"
                      id="clip_skip"
                      v-model.number="form.clipSkip"
                      min="1"
                      max="12"
                      step="1"
                    />
                    <span class="range-value">{{ form.clipSkip }}</span>
                  </div>
                </div>

                <div class="form-group">
                  <label>Seed</label>
                  <div class="seed-control-group">
                    <input
                      v-if="!form.useRandomSeed"
                      type="text"
                      id="seed"
                      v-model="form.seed"
                      placeholder="Enter seed number"
                      class="seed-input"
                    />
                    <div class="seed-randomize">
                      <span>Randomize Seed</span>
                      <label class="toggle-switch">
                        <input type="checkbox" v-model="form.useRandomSeed" />
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label>Other Options</label>
                  <div class="toggle-control">
                    <span>Karras</span>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="form.karras" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="hires-fix-container">
                    <div class="toggle-control">
                      <span>Hires Fix</span>
                      <label class="toggle-switch">
                        <input type="checkbox" v-model="form.hiresFix" />
                        <span class="toggle-slider"></span>
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
                </div>
              </div>

              <!-- Face Fix Section -->
              <h4 class="section-title">Face Fix</h4>
              <div class="face-fix-section">
                <div class="form-group">
                  <label for="face_fix">Face Fix</label>
                  <select id="face_fix" v-model="form.faceFix">
                    <option value="none">None</option>
                    <option value="GFPGAN">GFPGAN</option>
                    <option value="CodeFormers">CodeFormers</option>
                  </select>
                </div>

                <div v-if="form.faceFix !== 'none'" class="form-group">
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
              <h4 class="section-title">Upscalers</h4>
              <div class="upscalers-section">
                <div class="toggle-list">
                  <div class="toggle-control">
                    <span>4x AnimeSharp</span>
                    <label class="toggle-switch">
                      <input type="checkbox" value="4x_AnimeSharp" v-model="form.upscalers" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-control">
                    <span>NMKD Siax</span>
                    <label class="toggle-switch">
                      <input type="checkbox" value="NMKD_Siax" v-model="form.upscalers" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-control">
                    <span>RealESRGAN x2</span>
                    <label class="toggle-switch">
                      <input type="checkbox" value="RealESRGAN_x2plus" v-model="form.upscalers" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-control">
                    <span>RealESRGAN x4 Anime</span>
                    <label class="toggle-switch">
                      <input type="checkbox" value="RealESRGAN_x4plus_anime_6B" v-model="form.upscalers" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-control">
                    <span>RealESRGAN x4</span>
                    <label class="toggle-switch">
                      <input type="checkbox" value="RealESRGAN_x4plus" v-model="form.upscalers" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Advanced Options Section -->
              <h4 class="section-title">Advanced Options</h4>
              <div class="advanced-options-section">
                <div class="toggle-list">
                  <div class="toggle-control">
                    <span>Tiling</span>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="form.tiling" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-control">
                    <span>Transparent Background</span>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="form.transparent" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-control">
                    <span>Strip Background</span>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="form.stripBackground" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
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
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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

    // Auto-expand textarea to fit content
    const autoExpand = (event) => {
      const textarea = event.target
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
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

    // Debounced version for slider changes
    let estimateKudosTimeout = null
    const estimateKudosDebounced = () => {
      if (estimateKudosTimeout) {
        clearTimeout(estimateKudosTimeout)
      }
      estimateKudosTimeout = setTimeout(() => {
        estimateKudos()
      }, 500) // Wait 500ms after user stops moving slider
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

    // Auto-estimate kudos when key parameters change (debounced for sliders)
    watch(
      () => [form.model, form.n, form.steps, form.width, form.height, selectedStyleName.value],
      () => {
        if (form.model) {
          estimateKudosDebounced()
        }
      }
    )

    // Generate random seed when toggling off random seed
    watch(
      () => form.useRandomSeed,
      (newValue, oldValue) => {
        // When switching from random (true) to fixed (false), generate a random seed
        if (oldValue === true && newValue === false) {
          form.seed = String(Math.floor(Math.random() * 100000000))
        }
      }
    )

    // Auto-expand textareas when content changes programmatically
    watch(
      () => [form.prompt, form.negativePrompt],
      async () => {
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

      // Auto-expand textareas on initial load
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
    })

    onUnmounted(() => {
      // Clean up debounce timeout
      if (estimateKudosTimeout) {
        clearTimeout(estimateKudosTimeout)
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
      autoExpand,
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

/* Face Fix Section */
.face-fix-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.face-fix-section .form-group {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.face-fix-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.face-fix-section .form-group:last-child > *:last-child {
  margin-bottom: 0;
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
  background: #333;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
  font-family: inherit;
}

.form-group select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1em;
  padding-right: 2.5rem;
}

.form-group textarea {
  resize: vertical;
  overflow-y: hidden;
  min-height: 80px;
  transition: height 0.1s ease;
}

#negative_prompt {
  min-height: 50px;
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
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 0;
}

/* WebKit track */
.slider-group input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 5px;
  background: #333;
  border-radius: 2px;
}

/* WebKit thumb */
.slider-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  background: #007AFF;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -10.5px;
  transition: all 0.15s ease;
}

.slider-group input[type="range"]::-webkit-slider-thumb:hover {
  background: #0051D5;
  transform: scale(1.1);
}

/* Firefox track */
.slider-group input[type="range"]::-moz-range-track {
  width: 100%;
  height: 5px;
  background: #333;
  border-radius: 2px;
  border: none;
}

/* Firefox thumb */
.slider-group input[type="range"]::-moz-range-thumb {
  width: 24px;
  height: 24px;
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

.range-value {
  display: inline-block;
  min-width: 50px;
  text-align: center;
  padding: 0.5rem;
  color: #fff;
  font-size: 1rem;
}

.selector-button {
  width: 100%;
  padding: 0.75rem;
  background: #333;
  border: 1px solid #444;
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

/* Section Title (outside boxes) */
.section-title {
  margin: 1.5rem 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #999;
  letter-spacing: 0.05em;
}

.section-title:first-child {
  margin-top: 0;
}

/* Basic Settings Section */
.basic-settings-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.basic-settings-section .form-group {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.basic-settings-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.basic-settings-section .form-group:last-child > *:last-child {
  margin-bottom: 0;
}

/* Generation Settings Section */
.generation-settings-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.generation-settings-section .form-group {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.generation-settings-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.generation-settings-section .form-group:last-child > *:last-child {
  margin-bottom: 0;
}

/* Seed Control Group */
.seed-control-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.seed-input {
  width: 100%;
  padding: 0.75rem;
  background: #333;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
  font-family: inherit;
}

.seed-input:focus {
  outline: none;
  border-color: #007AFF;
}

.seed-randomize {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.seed-randomize span {
  color: #fff;
  font-size: 0.9rem;
}

/* Toggle Control */
.toggle-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-control span {
  color: #fff;
  font-size: 0.9rem;
}

/* Hires Fix Container */
.hires-fix-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hires-fix-controls {
  margin-top: 0.5rem;
}

/* Dimensions Section */
.dimensions-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.dimensions-section .form-group {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dimensions-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.dimensions-section .form-group:last-child > *:last-child {
  margin-bottom: 0;
}

.dimensions-section .btn-swap-dimensions {
  margin-top: 1rem;
}

/* Aspect Ratio Control */
.aspect-ratio-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  background: #007AFF;
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
  background: #0051D5;
}

.btn-swap-dimensions:active {
  transform: scale(0.98);
}

.swap-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

/* Upscalers Section */
.upscalers-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.upscalers-section .toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Advanced Options Section */
.advanced-options-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.advanced-options-section .toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #007AFF;
}

.checkbox-item span {
  color: #fff;
  font-size: 0.9rem;
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
