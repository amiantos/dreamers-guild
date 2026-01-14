import { ref, watch, onUnmounted } from 'vue'
import { requestsApi } from '@api'
import { baseRequest, styleCopyParams } from '../../../config/baseRequest.js'
import { useKudosEstimation } from '../../../composables/useKudosEstimation.js'
import { useSettingsStore } from '../../../stores/settingsStore.js'
import { useLoraRecent } from '../../../composables/useLoraCache'
import { useTextualInversionRecent } from '../../../composables/useTextualInversionCache'

/**
 * Composable for handling generator form submission and kudos estimation.
 */
export function useGeneratorSubmit(generatorForm, persistence) {
  const {
    form,
    submitting,
    selectedStyleName,
    selectedStyleData,
    selectedAlbumId
  } = generatorForm

  const { saveLastUsedSettings } = persistence

  // Settings store for worker preferences
  const settingsStore = useSettingsStore()
  settingsStore.loadWorkerPreferences()

  // Kudos estimation
  const { kudosEstimate, estimating, estimateError, estimateKudos: estimateKudosComposable } = useKudosEstimation()

  // Recent LoRA/TI tracking
  const { addToRecent } = useLoraRecent()
  const { addToRecent: addTiToRecent } = useTextualInversionRecent()

  // Debounce timer
  let estimateKudosTimeout = null

  /**
   * Build prompt with style template applied.
   */
  const buildPromptWithStyle = () => {
    if (!selectedStyleName.value || !selectedStyleData.value || !selectedStyleData.value.prompt) {
      // No style - combine prompts with ### separator if both exist
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

    // Handle negative prompt placeholder
    if (userNegativePrompt === '') {
      generationText = generationText.replace(/{np},/g, '')
      generationText = generationText.replace(/{np}/g, '')
    } else if (generationText.includes('###')) {
      generationText = generationText.replace(/{np}/g, userNegativePrompt)
    } else {
      generationText = generationText.replace(/{np}/g, ` ### ${userNegativePrompt}`)
    }

    return {
      prompt: generationText,
      negativePrompt: null
    }
  }

  /**
   * Build raw settings for saving (preserves original form values without style processing).
   */
  const buildRawSettingsForSave = () => {
    let promptToSave = form.prompt
    if (form.negativePrompt) {
      promptToSave = `${form.prompt} ### ${form.negativePrompt}`
    }

    const settings = {
      prompt: promptToSave,
      models: [form.model],
      params: {
        n: form.n,
        steps: form.steps,
        width: form.width,
        height: form.height,
        cfg_scale: form.cfgScale,
        sampler_name: form.sampler,
        karras: form.karras,
        hires_fix: form.hiresFix,
        clip_skip: form.clipSkip,
        tiling: form.tiling
      }
    }

    if (form.hiresFix) {
      settings.params.hires_fix_denoising_strength = form.hiresFixDenoisingStrength
    }

    if (!form.useRandomSeed && form.seed) {
      settings.params.seed = form.seed
    }

    // Save LoRAs in minimal format
    if (form.loras && form.loras.length > 0) {
      settings.params.loras = form.loras.map(lora => {
        if (lora.toHordeFormat && typeof lora.toHordeFormat === 'function') {
          return lora.toHordeFormat()
        }
        return {
          name: lora.name || String(lora.civitaiId),
          model: lora.strength || 1,
          clip: lora.clip || 1,
          is_version: true
        }
      })
    }

    // Save TIs in minimal format
    if (form.tis && form.tis.length > 0) {
      settings.params.tis = form.tis.map(ti => {
        if (ti.toHordeFormat && typeof ti.toHordeFormat === 'function') {
          return ti.toHordeFormat()
        }
        return {
          name: ti.name || String(ti.civitaiId),
          strength: ti.strength || 1,
          inject_ti: ti.inject || 'prompt'
        }
      })
    }

    // Save post-processing
    const postProcessing = []
    if (form.faceFix !== 'none') {
      postProcessing.push(form.faceFix)
      settings.params.facefixer_strength = form.faceFixStrength
    }
    if (form.upscaler && form.upscaler !== 'none') {
      postProcessing.push(form.upscaler)
    }
    if (form.stripBackground) {
      postProcessing.push('strip_background')
    }
    if (postProcessing.length > 0) {
      settings.params.post_processing = postProcessing
    }

    return settings
  }

  /**
   * Build request parameters for API submission.
   */
  const buildRequestParams = () => {
    const { prompt: finalPrompt, negativePrompt: finalNegativePrompt } = buildPromptWithStyle()

    // Start with baseRequest as foundation
    const params = JSON.parse(JSON.stringify(baseRequest))

    params.prompt = finalPrompt
    params.models = [form.model]

    // Apply worker preferences from settings store
    params.nsfw = settingsStore.workerPreferences.nsfw
    params.censor_nsfw = !settingsStore.workerPreferences.nsfw
    params.trusted_workers = settingsStore.workerPreferences.trustedWorkers
    params.slow_workers = settingsStore.workerPreferences.slowWorkers
    params.allow_downgrade = settingsStore.workerPreferences.allowDowngrade
    params.replacement_filter = settingsStore.workerPreferences.replacementFilter

    if (form.transparent) {
      params.transparent = true
    }

    // If a style is selected, apply style parameters
    if (selectedStyleName.value && selectedStyleData.value) {
      const style = selectedStyleData.value

      styleCopyParams.forEach(param => {
        const value = style[param]
        if (value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)) {
          params.params[param] = value
        }
      })

      if (style.model) {
        params.models = [style.model]
      }
    } else {
      // No style - use user's custom settings
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

      if (!form.useRandomSeed && form.seed) {
        params.params.seed = form.seed
      }

      // Build post-processing array
      const postProcessing = []
      if (form.faceFix !== 'none') {
        postProcessing.push(form.faceFix)
        params.params.facefixer_strength = form.faceFixStrength
      }
      if (form.upscaler && form.upscaler !== 'none') {
        postProcessing.push(form.upscaler)
      }
      if (form.stripBackground) {
        postProcessing.push('strip_background')
      }
      if (postProcessing.length > 0) {
        params.params.post_processing = postProcessing
      }

      // Add loras
      if (form.loras && form.loras.length > 0) {
        params.params.loras = form.loras.map(lora => {
          if (lora.toHordeFormat && typeof lora.toHordeFormat === 'function') {
            return lora.toHordeFormat()
          }
          return {
            name: String(lora.versionId || lora.name),
            model: Number(lora.strength || lora.model || 1.0),
            clip: Number(lora.clip || 1.0),
            is_version: true
          }
        })
      }

      // Add TIs
      if (form.tis && form.tis.length > 0) {
        params.params.tis = form.tis.map(ti => {
          if (ti.toHordeFormat && typeof ti.toHordeFormat === 'function') {
            return ti.toHordeFormat()
          }
          const tiFormat = {
            name: String(ti.versionId || ti.name),
            strength: Number(ti.strength || 0.0),
            is_version: true
          }
          if (ti.inject_ti && ti.inject_ti !== 'none') {
            tiFormat.inject_ti = ti.inject_ti
          }
          return tiFormat
        })
      }
    }

    // User's image quantity always overrides
    params.params.n = form.n

    if (finalNegativePrompt) {
      params.params.negative_prompt = finalNegativePrompt
    }

    return params
  }

  /**
   * Estimate kudos for the current form state.
   */
  const estimateKudos = async () => {
    if (!form.model) return

    const params = buildRequestParams()
    await estimateKudosComposable(params)
  }

  /**
   * Debounced version of estimateKudos (500ms delay).
   */
  const estimateKudosDebounced = () => {
    if (estimateKudosTimeout) {
      clearTimeout(estimateKudosTimeout)
    }
    estimateKudosTimeout = setTimeout(() => {
      estimateKudos()
    }, 500)
  }

  /**
   * Submit the generation request.
   */
  const submitRequest = async (onSuccess) => {
    try {
      submitting.value = true

      // Build raw settings BEFORE style processing
      const rawSettingsToSave = buildRawSettingsForSave()

      const params = buildRequestParams()

      await requestsApi.create({
        prompt: form.prompt,
        params,
        albumId: selectedAlbumId.value || null
      })

      // Save raw form settings for next time
      await saveLastUsedSettings(rawSettingsToSave)

      // Add LoRAs to recent list
      if (form.loras && form.loras.length > 0) {
        try {
          for (const lora of form.loras) {
            await addToRecent(lora)
          }
        } catch (error) {
          console.error('Failed to update recent LoRAs:', error)
        }
      }

      // Add TIs to recent list
      if (form.tis && form.tis.length > 0) {
        try {
          for (const ti of form.tis) {
            await addTiToRecent(ti)
          }
        } catch (error) {
          console.error('Failed to update recent TIs:', error)
        }
      }

      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request. Please try again.')
    } finally {
      submitting.value = false
    }
  }

  /**
   * Set up watchers for auto kudos estimation.
   */
  const setupEstimationWatchers = () => {
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
        if (oldValue === true && newValue === false) {
          form.seed = String(Math.floor(Math.random() * 100000000))
        }
      }
    )
  }

  /**
   * Clean up debounce timeout.
   */
  const cleanup = () => {
    if (estimateKudosTimeout) {
      clearTimeout(estimateKudosTimeout)
    }
  }

  return {
    // State
    kudosEstimate,
    estimating,
    estimateError,
    settingsStore,

    // Methods
    buildPromptWithStyle,
    buildRawSettingsForSave,
    buildRequestParams,
    estimateKudos,
    estimateKudosDebounced,
    submitRequest,
    setupEstimationWatchers,
    cleanup
  }
}
