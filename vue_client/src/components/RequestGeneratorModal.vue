<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="modal-wrapper">
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
                    :style="{ background: getSliderBackground(form.n, 1, 20) }"
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
                  <span class="selector-value">{{ selectedStyleName || 'None' }}</span>
                  <span class="selector-arrow">›</span>
                </div>

                <!-- Apply/Remove Style Buttons (When Style is Selected) -->
                <div v-if="selectedStyleName" class="style-actions">
                  <button
                    type="button"
                    @click="applyStyle"
                    class="btn btn-apply-style"
                  >
                    Apply Style
                  </button>
                  <button
                    type="button"
                    @click="removeStyle"
                    class="btn btn-remove-style"
                  >
                    Remove Style
                  </button>
                  <p class="style-info-text">
                    While you have a style selected, all generation settings are controlled by the style. Remove or apply the style to access more generation settings.
                  </p>
                </div>
              </div>
            </div>

            <!-- Full Parameters (Only Visible When NO Style is Selected) -->
            <div v-if="!selectedStyleName" class="full-parameters">
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
                      :style="{ background: getSliderBackground(form.width, 64, 3072) }"
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
                      :style="{ background: getSliderBackground(form.height, 64, 3072) }"
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
                    class="btn btn-swap-dimensions"
                    @click="swapDimensions"
                  >
                    <i class="fa-solid fa-arrows-rotate"></i> Swap Dimensions
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
                      :style="{ background: getSliderBackground(form.steps, 1, 150) }"
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
                      :style="{ background: getSliderBackground(form.cfgScale, 1, 30) }"
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
                      :style="{ background: getSliderBackground(form.clipSkip, 1, 12) }"
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
                          :style="{ background: getSliderBackground(form.hiresFixDenoisingStrength, 0, 1) }"
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

              <!-- Loras Section -->
              <h4 class="section-title">LoRAs</h4>
              <div class="loras-section">
                <!-- LoRAs -->
                <div class="form-group">
                  <button
                    type="button"
                    class="btn btn-browse-loras"
                    @click="showLoraPicker = true"
                  >
                    Browse LoRAs
                  </button>
                  <div v-if="form.loras.length > 0" class="loras-list">
                    <div
                      v-for="(lora, idx) in form.loras"
                      :key="`lora-${idx}`"
                      class="lora-card"
                    >
                      <!-- Lora Header -->
                      <div class="lora-header">
                        <div class="lora-title-section">
                          <span class="lora-title">{{ lora.name }}</span>
                          <span v-if="currentLoraVersion(lora)" class="lora-version">{{ currentLoraVersion(lora).name }}</span>
                        </div>
                        <div class="lora-actions">
                          <button
                            type="button"
                            class="btn-icon-small"
                            @click="showLoraInfo(lora)"
                            title="Show LoRA details"
                            :disabled="lora.isManualEntry"
                          >
                            <i class="fas fa-info-circle"></i>
                          </button>
                          <button
                            type="button"
                            class="btn-icon-small btn-danger"
                            @click="removeLora(idx)"
                            title="Remove LoRA"
                          >
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      <!-- Model Strength -->
                      <div class="lora-control-group">
                        <label class="lora-control-label">Model Strength</label>
                        <div class="slider-group">
                          <input
                            type="range"
                            v-model.number="lora.strength"
                            :style="{ background: getSliderBackground(lora.strength, -5, 5) }"
                            @input="onLoraStrengthChange(idx)"
                            min="-5"
                            max="5"
                            step="0.05"
                          />
                          <span class="range-value">{{ lora.strength }}</span>
                        </div>
                      </div>

                      <!-- CLIP Strength -->
                      <div class="lora-control-group">
                        <label class="lora-control-label">CLIP Strength</label>
                        <div class="slider-group">
                          <input
                            type="range"
                            v-model.number="lora.clip"
                            :style="{ background: getSliderBackground(lora.clip, -5, 5) }"
                            @input="onLoraClipChange(idx)"
                            min="-5"
                            max="5"
                            step="0.05"
                          />
                          <span class="range-value">{{ lora.clip }}</span>
                        </div>
                      </div>

                      <!-- Trigger Words -->
                      <div v-if="loraTrainedWords(lora).length > 0" class="lora-trigger-words">
                        <span class="trigger-label">Trigger words:</span>
                        <div class="trigger-chips">
                          <button
                            type="button"
                            v-for="word in loraTrainedWords(lora)"
                            :key="word"
                            class="trigger-chip"
                            @click="addTriggerWord(word)"
                            :title="`Add '${word}' to prompt`"
                          >
                            {{ word }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Textual Inversions Section -->
              <h4 class="section-title">Textual Inversions</h4>
              <div class="tis-section">
                <!-- Textual Inversions -->
                <div class="form-group">
                  <button
                    type="button"
                    class="btn btn-browse-tis"
                    @click="showTiPicker = true"
                  >
                    Browse Textual Inversions
                  </button>
                  <div v-if="form.tis.length > 0" class="tis-list">
                    <div
                      v-for="(ti, idx) in form.tis"
                      :key="`ti-${idx}`"
                      class="ti-card"
                    >
                      <!-- TI Header -->
                      <div class="ti-header">
                        <div class="ti-title-section">
                          <span class="ti-title">{{ ti.name }}</span>
                          <span v-if="currentTiVersion(ti)" class="ti-version">{{ currentTiVersion(ti).name }}</span>
                        </div>
                        <div class="ti-actions">
                          <button
                            type="button"
                            class="btn-icon-small"
                            @click="showTiInfo(ti)"
                            title="Show TI details"
                            :disabled="ti.isManualEntry"
                          >
                            <i class="fas fa-info-circle"></i>
                          </button>
                          <button
                            type="button"
                            class="btn-icon-small btn-danger"
                            @click="removeTi(idx)"
                            title="Remove TI"
                          >
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      <!-- Strength -->
                      <div class="ti-control-group">
                        <label class="ti-control-label">Strength</label>
                        <div class="slider-group">
                          <input
                            type="range"
                            v-model.number="ti.strength"
                            :style="{ background: getSliderBackground(ti.strength, -5, 5) }"
                            @input="onTiStrengthChange(idx)"
                            min="-5"
                            max="5"
                            step="0.05"
                          />
                          <span class="range-value">{{ ti.strength }}</span>
                        </div>
                      </div>

                      <!-- Inject Dropdown -->
                      <div class="ti-control-group">
                        <label class="ti-control-label">Inject</label>
                        <select
                          v-model="ti.inject_ti"
                          @change="onTiInjectChange(idx)"
                          class="inject-select"
                        >
                          <option value="prompt">Prompt</option>
                          <option value="negprompt">Negative Prompt</option>
                          <option value="none">None</option>
                        </select>
                      </div>

                      <!-- Trigger Words -->
                      <div v-if="tiTrainedWords(ti).length > 0" class="ti-trigger-words">
                        <span class="trigger-label">Trigger words:</span>
                        <div class="trigger-chips">
                          <button
                            type="button"
                            v-for="word in tiTrainedWords(ti)"
                            :key="word"
                            class="trigger-chip"
                            @click="addTriggerWord(word)"
                            :title="`Add '${word}' to prompt`"
                          >
                            {{ word }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Post-Processing Section -->
              <h4 class="section-title">Post-Processing</h4>
              <div class="post-processing-section">
                <div class="form-group">
                  <label for="face_fix">Face Fix</label>
                  <select id="face_fix" v-model="form.faceFix">
                    <option value="none">None</option>
                    <option value="GFPGAN">GFPGAN</option>
                    <option value="CodeFormers">CodeFormers</option>
                  </select>
                  <div v-if="form.faceFix !== 'none'" class="form-group-internal">
                    <label for="face_fix_strength">Face Fix Strength</label>
                    <div class="slider-group">
                      <input
                        type="range"
                        id="face_fix_strength"
                        v-model.number="form.faceFixStrength"
                        :style="{ background: getSliderBackground(form.faceFixStrength, 0, 1) }"
                        min="0"
                        max="1"
                        step="0.05"
                      />
                      <span class="range-value">{{ form.faceFixStrength }}</span>
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label for="upscaler">Upscaler</label>
                  <select id="upscaler" v-model="form.upscaler">
                    <option value="none">None</option>
                    <option value="RealESRGAN_x4plus">RealESRGAN x4</option>
                    <option value="RealESRGAN_x4plus_anime_6B">RealESRGAN x4 Anime</option>
                    <option value="RealESRGAN_x2plus">RealESRGAN x2</option>
                    <option value="NMKD_Siax">NMKD Siax</option>
                    <option value="4x_AnimeSharp">4x AnimeSharp</option>
                  </select>
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
          <!-- Kudos Estimate or Error -->
          <div class="kudos-estimate" v-if="kudosEstimate !== null || estimateError !== null">
            <span v-if="kudosEstimate !== null" class="kudos-label">Kudos Cost: ~{{ kudosEstimate.toLocaleString() }} kudos for {{ form.n.toLocaleString() }} images, ~{{ (kudosEstimate / form.n).toFixed(0).toLocaleString() }} per image</span>
            <span v-else-if="estimateError !== null" class="kudos-error">{{ estimateError }}</span>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button type="submit" @click="submitRequest" class="btn btn-submit" :disabled="submitting">
              <i class="fa-regular fa-paper-plane paper-plane-icon"></i> {{ submitting ? 'Submitting...' : 'Send Request' }}
            </button>
          </div>
        </div>
      </div>

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

  <!-- Independent Modals -->
  <!-- Model Picker Modal -->
  <ModelPicker
    v-if="showModelPicker"
    :currentModel="form.model"
    @select="onModelSelect"
    @close="showModelPicker = false"
  />

  <!-- Style Picker Modal -->
  <StylePicker
    v-if="showStylePicker"
    :currentStyle="selectedStyleName"
    @select="onStyleSelect"
    @close="showStylePicker = false"
  />

  <!-- LoRA Picker Modal -->
  <LoraPicker
    v-if="showLoraPicker"
    :currentLoras="form.loras"
    @add="addLora"
    @close="showLoraPicker = false"
  />

  <!-- Textual Inversion Picker Modal -->
  <TextualInversionPicker
    v-if="showTiPicker"
    :currentTis="form.tis"
    @add="addTi"
    @close="showTiPicker = false"
  />
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
import LoraPicker from './LoraPicker.vue'
import LoraDetails from './LoraDetails.vue'
import { getLoraById, getLoraByVersionId, getTiById, getTiByVersionId } from '../api/civitai'
import { SavedLora } from '../models/Lora'
import { SavedTextualInversion } from '../models/TextualInversion'
import { useLoraRecent } from '../composables/useLoraCache'
import { useTextualInversionRecent } from '../composables/useTextualInversionCache'
import TextualInversionPicker from './TextualInversionPicker.vue'
import TextualInversionDetails from './TextualInversionDetails.vue'

export default {
  name: 'RequestGeneratorModal',
  components: {
    ModelPicker,
    StylePicker,
    LoraPicker,
    LoraDetails,
    TextualInversionPicker,
    TextualInversionDetails
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
    const showLoraPicker = ref(false)
    const showLoraDetails = ref(false)
    const selectedLoraForDetails = ref(null)
    const showTiPicker = ref(false)
    const showTiDetails = ref(false)
    const selectedTiForDetails = ref(null)
    const aspectLocked = ref(false)
    const aspectRatio = ref(1)
    const selectedStyleName = ref('')
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
      upscaler: 'none',
      stripBackground: false,
      loras: [],
      tis: []
    })

    // Use composables
    const { models, fetchModels, getMostPopularModel } = useModelCache()
    const { kudosEstimate, estimating, estimateError, estimateKudos: estimateKudosComposable } = useKudosEstimation()
    const { addToRecent } = useLoraRecent()
    const { addToRecent: addTiToRecent } = useTextualInversionRecent()

    // Load worker preferences from settings store
    settingsStore.loadWorkerPreferences()

    // Load last used settings (from localStorage for speed, fallback to server)
    // Now loads the actual Horde request and uses loadSettings() for enrichment
    const loadLastUsedSettings = async () => {
      try {
        // Try localStorage first for instant loading
        const cachedSettings = localStorage.getItem('lastUsedSettings')
        if (cachedSettings) {
          try {
            const lastSettings = JSON.parse(cachedSettings)
            if (lastSettings && typeof lastSettings === 'object') {
              // Use the standard loadSettings function (same as historical requests)
              // This will enrich minimal LoRA data from cache
              await loadSettings(lastSettings, false)
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
              // Use the standard loadSettings function
              await loadSettings(lastSettings, false)
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
    // Now saves the actual Horde request params, not form state
    // This way loading uses the same enrichment logic as historical requests
    const saveLastUsedSettings = async (requestParams) => {
      try {
        // Save the actual request that was sent to Horde
        // This includes minimal LoRA data that will be enriched on load
        const settingsToSave = {
          prompt: requestParams.prompt,
          models: requestParams.models,
          params: requestParams.params
        }

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
      selectedStyleData.value = style
    }

    // LoRA handlers
    const addLora = (lora) => {
      form.loras.push(lora)
      estimateKudos()
    }

    const removeLora = (index) => {
      form.loras.splice(index, 1)
      estimateKudos()
    }

    const onLoraStrengthChange = (index) => {
      // Round to nearest 0.05
      const rounded = Math.round(form.loras[index].strength * 20) / 20
      form.loras[index].strength = parseFloat(rounded.toFixed(2))
      estimateKudosDebounced()
    }

    const onLoraClipChange = (index) => {
      // Round to nearest 0.05
      const rounded = Math.round(form.loras[index].clip * 20) / 20
      form.loras[index].clip = parseFloat(rounded.toFixed(2))
      estimateKudosDebounced()
    }

    const currentLoraVersion = (lora) => {
      if (!lora.modelVersions || lora.modelVersions.length === 0) {
        return null
      }
      return lora.modelVersions.find(v => v.id === lora.versionId) || lora.modelVersions[0]
    }

    const loraTrainedWords = (lora) => {
      const version = currentLoraVersion(lora)
      if (!version || !version.trainedWords) {
        return []
      }
      return version.trainedWords
    }

    const addTriggerWord = (word) => {
      const textarea = document.getElementById('prompt')
      if (!textarea) {
        // Fallback: just append to the end
        form.prompt = form.prompt ? `${form.prompt} ${word}` : word
        return
      }

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const currentPrompt = form.prompt || ''

      // Insert the word at cursor position with appropriate spacing
      const beforeCursor = currentPrompt.substring(0, start)
      const afterCursor = currentPrompt.substring(end)

      // Add space before word if needed
      const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ')
      const needsSpaceAfter = afterCursor.length > 0 && !afterCursor.startsWith(' ')

      const wordToInsert = (needsSpaceBefore ? ' ' : '') + word + (needsSpaceAfter ? ' ' : '')
      form.prompt = beforeCursor + wordToInsert + afterCursor

      // Move cursor to after the inserted word
      nextTick(() => {
        const newCursorPos = start + wordToInsert.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        textarea.focus()
      })
    }

    const showLoraInfo = (lora) => {
      selectedLoraForDetails.value = lora
      showLoraDetails.value = true
    }

    const removeLoraFromDetails = (versionId) => {
      // Find and remove the lora with the specific version ID
      const index = form.loras.findIndex(lora =>
        lora.versionId === versionId
      )
      if (index !== -1) {
        removeLora(index)
      }
    }

    // Textual Inversion handlers
    const addTi = (ti) => {
      console.log('[RequestGeneratorModal] addTi called with:', ti)
      form.tis.push(ti)
      console.log('[RequestGeneratorModal] form.tis after push:', form.tis)
      estimateKudos()
    }

    const removeTi = (index) => {
      form.tis.splice(index, 1)
      estimateKudos()
    }

    const onTiStrengthChange = (index) => {
      // Round to nearest 0.05
      const rounded = Math.round(form.tis[index].strength * 20) / 20
      form.tis[index].strength = parseFloat(rounded.toFixed(2))
      estimateKudosDebounced()
    }

    const onTiInjectChange = (index) => {
      estimateKudosDebounced()
    }

    const currentTiVersion = (ti) => {
      if (!ti.modelVersions || ti.modelVersions.length === 0) {
        return null
      }
      // Use loose equality to handle string/number type mismatch
      return ti.modelVersions.find(v => v.id == ti.versionId) || ti.modelVersions[0]
    }

    const tiTrainedWords = (ti) => {
      const version = currentTiVersion(ti)
      if (!version || !version.trainedWords) {
        return []
      }
      return version.trainedWords
    }

    const showTiInfo = async (ti) => {
      // Fetch full model data to ensure we have complete metadata
      try {
        const fullModelData = await getTiById(ti.id)
        selectedTiForDetails.value = fullModelData
        showTiDetails.value = true
      } catch (error) {
        console.error('Error fetching full TI data:', error)
        // Fallback to using the enriched data we already have
        selectedTiForDetails.value = ti
        showTiDetails.value = true
      }
    }

    const removeTiFromDetails = (versionId) => {
      // Find and remove the TI with the specific version ID
      const index = form.tis.findIndex(ti =>
        ti.versionId === versionId
      )
      if (index !== -1) {
        removeTi(index)
      }
    }

    // Helper to enrich minimal TI data with full CivitAI details
    const enrichTis = async (tis) => {
      if (!tis || !Array.isArray(tis) || tis.length === 0) {
        return []
      }

      const enriched = []
      for (const ti of tis) {
        try {
          // AI Horde format stores version ID in 'name' field
          const versionId = ti.versionId || ti.name
          console.log('[enrichTis] Processing TI:', { ti, versionId })
          if (versionId) {
            const fullData = await getTiByVersionId(versionId)
            console.log('[enrichTis] Got fullData:', { modelId: fullData.id, name: fullData.name, versionCount: fullData.modelVersions?.length })
            const enrichedTi = SavedTextualInversion.fromEmbedding(fullData, versionId, {
              strength: ti.strength || 0.0,
              // If inject_ti is not provided, default to 'none' (not 'prompt')
              inject_ti: ti.inject_ti !== undefined ? ti.inject_ti : 'none'
            })
            console.log('[enrichTis] Created enrichedTi:', { versionId: enrichedTi.versionId, name: enrichedTi.name })
            enriched.push(enrichedTi)
          } else {
            enriched.push(ti)
          }
        } catch (error) {
          console.error(`Failed to enrich TI ${ti.versionId || ti.name}:`, error)
          enriched.push(ti)
        }
      }
      return enriched
    }

    // Helper to enrich minimal LoRA data with full CivitAI details
    const enrichLoras = async (loras) => {
      if (!loras || !Array.isArray(loras) || loras.length === 0) {
        return []
      }

      const enrichedLoras = []
      const minimalLoras = []
      const minimalIndices = []

      // First pass: separate minimal from full LoRAs
      for (let i = 0; i < loras.length; i++) {
        const lora = loras[i]
        // Check if this is a minimal LoRA (just name and is_version from AI Horde)
        const isMinimal = lora.name && !lora.versionId && !lora.modelVersions

        if (isMinimal) {
          minimalLoras.push(lora)
          minimalIndices.push(i)
        }
      }

      // If we have minimal LoRAs, enrich them from server
      // Server automatically checks: LoraCache → CivitaiSearchCache → CivitAI API
      let enrichmentMap = {}
      if (minimalLoras.length > 0) {
        for (const lora of minimalLoras) {
          const versionId = lora.name
          try {
            const modelData = await getLoraByVersionId(versionId)
            if (modelData) {
              enrichmentMap[versionId] = modelData
            }
          } catch (error) {
            console.warn(`Could not fetch LoRA version ${versionId}:`, error)
            // Will fall through to stub creation
          }
        }
      }

      // Second pass: reconstruct enriched array
      for (let i = 0; i < loras.length; i++) {
        const lora = loras[i]
        const isMinimal = lora.name && !lora.versionId && !lora.modelVersions

        if (isMinimal) {
          const versionId = lora.name
          const cached = enrichmentMap[versionId]

          if (cached) {
            // Found in cache or recent - use it and restore strengths from request
            // IMPORTANT: Explicitly set versionId to preserve the specific version that was selected
            // Convert to number to match the type in modelVersions (CivitAI uses numeric IDs)
            const enrichedLora = new SavedLora({
              ...cached,
              versionId: Number(versionId),  // Convert to number to match modelVersions[].id type
              strength: lora.model || 1.0,
              clip: lora.clip || 1.0
            })
            enrichedLoras.push(enrichedLora)
          } else {
            // Not found anywhere - create stub
            enrichedLoras.push(new SavedLora({
              id: Number(versionId),
              versionId: Number(versionId),
              name: `LoRA ${versionId}`,
              versionName: 'Unknown',
              strength: lora.model || 1.0,
              clip: lora.clip || 1.0,
              isManualEntry: true,
              modelVersions: []
            }))
          }
        } else {
          // Already a full SavedLora object
          enrichedLoras.push(lora)
        }
      }

      return enrichedLoras
    }

    // Load settings from an arbitrary settings object
    const loadSettings = async (settings, includeSeed = false) => {
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

        // Load and enrich LoRAs
        if (params.loras && params.loras.length > 0) {
          form.loras = await enrichLoras(params.loras)
          // Note: Cache is automatically populated by server when enriching via CivitAI API
        } else {
          form.loras = []
        }

        // Load and enrich TIs
        if (params.tis && params.tis.length > 0) {
          form.tis = await enrichTis(params.tis)
          // Note: Cache is automatically populated by server when enriching via CivitAI API
        } else {
          form.tis = []
        }

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

          // Check for upscalers (only one can be selected)
          const upscalerOptions = ['4x_AnimeSharp', 'NMKD_Siax', 'RealESRGAN_x2plus', 'RealESRGAN_x4plus_anime_6B', 'RealESRGAN_x4plus']
          const foundUpscaler = pp.find(item => upscalerOptions.includes(item))
          form.upscaler = foundUpscaler || 'none'

          // Check for strip_background
          form.stripBackground = pp.includes('strip_background')
        } else {
          form.faceFix = 'none'
          form.faceFixStrength = 0.5
          form.upscaler = 'none'
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
      selectedStyleName.value = ''
      selectedStyleData.value = null

      // Re-estimate kudos
      estimateKudos()
    }

    const loadRandomPreset = async () => {
      const preset = getRandomPreset()
      await loadSettings(preset)
    }

    const removeStyle = () => {
      selectedStyleName.value = ''
      selectedStyleData.value = null
    }

    const applyStyle = async () => {
      if (!selectedStyleData.value) {
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
        form.loras = await enrichLoras(style.loras)
      } else {
        form.loras = []
      }

      // Clear post-processing options when style is applied
      form.faceFix = 'none'
      form.faceFixStrength = 0.5
      form.upscaler = 'none'
      form.stripBackground = false

      // Deselect the style
      removeStyle()

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

    // Calculate slider fill percentage for gradient background
    const getSliderBackground = (value, min, max) => {
      const percentage = ((value - min) / (max - min)) * 100
      return `linear-gradient(to right, #587297 0%, #587297 ${percentage}%, #333 ${percentage}%, #333 100%)`
    }

    // Auto-expand textarea to fit content
    const autoExpand = (event) => {
      const textarea = event.target
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }

    const buildPromptWithStyle = () => {
      // If no style is selected or no style data, return prompts as-is
      if (!selectedStyleName.value || !selectedStyleData.value || !selectedStyleData.value.prompt) {
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
      params.censor_nsfw = !settingsStore.workerPreferences.nsfw
      params.trusted_workers = settingsStore.workerPreferences.trustedWorkers
      params.slow_workers = settingsStore.workerPreferences.slowWorkers
      params.allow_downgrade = settingsStore.workerPreferences.allowDowngrade
      params.replacement_filter = settingsStore.workerPreferences.replacementFilter
      
      // Add transparent flag if enabled
      if (form.transparent) {
        params.transparent = true
      }

      // If a style is selected, apply style parameters on top of baseRequest
      if (selectedStyleName.value && selectedStyleData.value) {
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
        // 2. Upscaler (if selected)
        // 3. Strip background (if enabled, must be last)
        const postProcessing = []

        // Add face fixer first
        if (form.faceFix !== 'none') {
          postProcessing.push(form.faceFix)
          // Add face fixer strength parameter
          params.params.facefixer_strength = form.faceFixStrength
        }

        // Add upscaler
        if (form.upscaler && form.upscaler !== 'none') {
          postProcessing.push(form.upscaler)
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
          // Convert SavedLora objects to AI Horde format
          params.params.loras = form.loras.map(lora => {
            // If it's a SavedLora instance, use toHordeFormat()
            if (lora.toHordeFormat && typeof lora.toHordeFormat === 'function') {
              return lora.toHordeFormat()
            }
            // Fallback: manually create minimal format from plain object
            // This shouldn't happen if everything is working correctly,
            // but provides safety against sending full objects
            return {
              name: String(lora.versionId || lora.name),
              model: Number(lora.strength || lora.model || 1.0),
              clip: Number(lora.clip || 1.0),
              is_version: true
            }
          })
        }

        // Add textual inversions to request params
        if (form.tis && form.tis.length > 0) {
          // Convert SavedTextualInversion objects to AI Horde format
          params.params.tis = form.tis.map(ti => {
            // If it's a SavedTextualInversion instance, use toHordeFormat()
            if (ti.toHordeFormat && typeof ti.toHordeFormat === 'function') {
              return ti.toHordeFormat()
            }
            // Fallback: manually create minimal format from plain object
            const tiFormat = {
              name: String(ti.versionId || ti.name),
              strength: Number(ti.strength || 0.0),
              is_version: true
            }
            // Only include inject_ti if it's not "none"
            if (ti.inject_ti && ti.inject_ti !== 'none') {
              tiFormat.inject_ti = ti.inject_ti
            }
            return tiFormat
          })
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

        // Save settings for next time (save the actual request, not form state)
        await saveLastUsedSettings(params)

        // Add LoRAs to recent list (after successful submission)
        // Note: Cache is automatically populated by server when fetching via CivitAI API
        if (form.loras && form.loras.length > 0) {
          try {
            for (const lora of form.loras) {
              await addToRecent(lora)
            }
          } catch (error) {
            console.error('Failed to update recent LoRAs:', error)
          }
        }

        // Add TIs to recent list (after successful submission)
        // Note: Cache is automatically populated by server when fetching via CivitAI API
        if (form.tis && form.tis.length > 0) {
          try {
            for (const ti of form.tis) {
              await addTiToRecent(ti)
            }
          } catch (error) {
            console.error('Failed to update recent TIs:', error)
          }
        }

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
      () => [
        form.model,
        form.n,
        form.steps,
        form.width,
        form.height,
        selectedStyleName.value,
        form.cfgScale,
        form.clipSkip,
        form.sampler,
        form.karras,
        form.hiresFix,
        form.hiresFixDenoisingStrength,
        form.tiling,
        form.transparent,
        form.faceFix,
        form.faceFixStrength,
        form.upscaler,
        form.stripBackground
      ],
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
        await loadSettings(props.initialSettings, props.includeSeed)
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
      estimateError,
      settingsStore,
      showModelPicker,
      showStylePicker,
      showLoraPicker,
      showLoraDetails,
      selectedLoraForDetails,
      showTiPicker,
      showTiDetails,
      selectedTiForDetails,
      aspectLocked,
      aspectRatioText,
      selectedStyleName,
      selectedStyleData,
      submitRequest,
      onModelSelect,
      onStyleSelect,
      addLora,
      removeLora,
      onLoraStrengthChange,
      onLoraClipChange,
      currentLoraVersion,
      loraTrainedWords,
      addTriggerWord,
      showLoraInfo,
      removeLoraFromDetails,
      addTi,
      removeTi,
      onTiStrengthChange,
      onTiInjectChange,
      currentTiVersion,
      tiTrainedWords,
      showTiInfo,
      removeTiFromDetails,
      applyStyle,
      removeStyle,
      onAspectLockToggle,
      onDimensionChange,
      swapDimensions,
      autoExpand,
      estimateKudos,
      loadSettings,
      loadRandomPreset,
      fetchModels,
      getSliderBackground
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

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  background: var(--color-surface);
  z-index: 1;
}

/* Loras Section */
.loras-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.2rem;
}

.loras-section .form-group {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.form-group-internal {
  padding-top:1.5rem;
}

.loras-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.loras-section .form-group:last-child > *:last-child {
  margin-bottom: 0;
}

/* Textual Inversions Section */
.tis-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.2rem;
}

.tis-section .form-group {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tis-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.tis-section .form-group:last-child > *:last-child {
  margin-bottom: 0;
}

/* Post-Processing Section */
.post-processing-section {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1.2rem;
}

.post-processing-section .form-group {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.form-group-internal {
  padding-top:1.5rem;
}

.post-processing-section .form-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.post-processing-section .form-group:last-child > *:last-child {
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
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--color-text-primary);
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.modal-footer {
  flex-shrink: 0;
  padding-bottom: 1.5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #333;
  background: var(--color-surface);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
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
  border-color: var(--color-primary);
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

.selector-button {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-button:hover {
  background: #252525;
  border-color: var(--color-border-light);
}

.selector-value {
  flex: 1;
  text-align: left;
}

.selector-arrow {
  color: var(--color-text-tertiary);
  font-size: 1.5rem;
  font-weight: 300;
}

/* LoRA Browse Button */
.btn-browse-loras {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-browse-loras:hover {
  background: var(--color-primary-hover);
}

/* LoRA Controls List */
.loras-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.75rem;
}

.lora-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 1rem;
}

.lora-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.lora-title-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lora-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text-primary);
}

.lora-version {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
}

.lora-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon-small {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-icon-small:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--color-text-primary);
}

.btn-icon-small:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-icon-small.btn-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.2);
  border-color: rgba(220, 38, 38, 0.3);
  color: #dc2626;
}

.lora-control-group {
  margin-bottom: 1rem;
}

.lora-control-group:last-of-type {
  margin-bottom: 0;
}

.lora-control-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-tertiary);
  margin-bottom: 0.5rem;
}

.lora-trigger-words {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.trigger-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-tertiary);
  margin-bottom: 0.5rem;
}

.trigger-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.trigger-chip {
  background: var(--color-primary);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s;
}

.trigger-chip:hover {
  background: var(--color-primary-hover);
}

/* Textual Inversions Controls */
.btn-browse-tis {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-browse-tis:hover {
  background: var(--color-primary-hover);
}

.tis-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.75rem;
}

.ti-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 1rem;
}

.ti-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.ti-title-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ti-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text-primary);
}

.ti-version {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
}

.ti-actions {
  display: flex;
  gap: 0.5rem;
}

.ti-control-group {
  margin-bottom: 1rem;
}

.ti-control-group:last-of-type {
  margin-bottom: 0;
}

.ti-control-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-tertiary);
  margin-bottom: 0.5rem;
}

.inject-select {
  width: 100%;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.inject-select:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.inject-select:focus {
  outline: none;
  border-color: var(--color-primary);
  background: rgba(255, 255, 255, 0.1);
}

.ti-trigger-words {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.style-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top:1rem;
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
  background: var(--color-primary);
  color: white;
}

.btn-apply-style:hover {
  background: var(--color-primary-hover);
}

.btn-remove-style {
  background: var(--color-primary);
  color: white;
}

.btn-remove-style:hover {
  background: var(--color-primary-hover);
}

.style-info-text {
  margin: 0;
  padding: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}

/* Section Title (outside boxes) */
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
  background: var(--color-border);
  border: 1px solid #444;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-family: inherit;
}

.seed-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.seed-randomize {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.seed-randomize span {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

/* Toggle Control */
.toggle-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-control span {
  color: var(--color-text-primary);
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

/* Swap Dimensions Button */
.btn-swap-dimensions {
  width: 100%;
  padding: 0.75rem 1.5rem;
  margin-top: 1rem;
  background: var(--color-primary);
  border: none;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-swap-dimensions:hover {
  background: var(--color-primary-hover);
}

.btn-swap-dimensions:active {
  transform: scale(0.98);
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
  accent-color: var(--color-primary);
}

.checkbox-item span {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.kudos-estimate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.kudos-label {
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

.kudos-error {
  color: var(--color-danger-hover);
  font-size: 0.9rem;
  font-weight: 500;
}

.btn-refresh {
  background: transparent;
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 6px;
  color: var(--color-primary);
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
  border-radius: 100px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid #333;
}

.btn-cancel:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.btn-submit {
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.paper-plane-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
