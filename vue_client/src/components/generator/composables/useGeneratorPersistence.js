import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { settingsApi, albumsApi } from '@api'
import { useAuthStore } from '../../../stores/authStore.js'
import { splitPrompt } from '../../../utils/promptUtils.js'

/**
 * Composable for handling generator form persistence.
 * Manages localStorage and server-side persistence for settings, styles, and albums.
 */
export function useGeneratorPersistence(generatorForm) {
  const {
    form,
    editorMode,
    selectedStyleName,
    selectedStyleData,
    selectedAlbumId,
    albums,
    enrichLoras,
    enrichTis
  } = generatorForm

  // Auth store for album loading
  const authStore = useAuthStore()
  const { isAuthenticated } = storeToRefs(authStore)
  const isHiddenAuthenticated = computed(() => isAuthenticated.value)

  /**
   * Load settings from an arbitrary settings object (e.g., from API response or localStorage).
   * Handles enrichment of LoRAs and TIs.
   */
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
      form.hiresFixDenoisingStrength = params.hires_fix_denoising_strength !== undefined
        ? params.hires_fix_denoising_strength : 0.65
      form.clipSkip = params.clip_skip !== undefined ? params.clip_skip : 1
      form.steps = params.steps !== undefined ? params.steps : 30
      form.n = params.n !== undefined ? params.n : 1
      form.tiling = params.tiling !== undefined ? params.tiling : false

      // Load and enrich LoRAs
      if (params.loras && params.loras.length > 0) {
        form.loras = await enrichLoras(params.loras)
      } else {
        form.loras = []
      }

      // Load and enrich TIs
      if (params.tis && params.tis.length > 0) {
        form.tis = await enrichTis(params.tis)
      } else {
        form.tis = []
      }

      // Parse post_processing array
      if (params.post_processing && Array.isArray(params.post_processing)) {
        const pp = params.post_processing

        // Face fixers
        if (pp.includes('GFPGAN')) {
          form.faceFix = 'GFPGAN'
        } else if (pp.includes('CodeFormers')) {
          form.faceFix = 'CodeFormers'
        } else {
          form.faceFix = 'none'
        }

        form.faceFixStrength = params.facefixer_strength !== undefined
          ? params.facefixer_strength : 0.5

        // Upscalers
        const upscalerOptions = ['4x_AnimeSharp', 'NMKD_Siax', 'RealESRGAN_x2plus',
          'RealESRGAN_x4plus_anime_6B', 'RealESRGAN_x4plus']
        const foundUpscaler = pp.find(item => upscalerOptions.includes(item))
        form.upscaler = foundUpscaler || 'none'

        // Strip background
        form.stripBackground = pp.includes('strip_background')
      } else {
        form.faceFix = 'none'
        form.faceFixStrength = 0.5
        form.upscaler = 'none'
        form.stripBackground = false
      }

      // Load seed if requested
      if (includeSeed && params.seed !== undefined && params.seed !== null && params.seed !== '') {
        form.seed = String(params.seed)
        form.useRandomSeed = false
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
  }

  /**
   * Load last used settings from localStorage or server.
   * Returns true if settings were found and loaded.
   */
  const loadLastUsedSettings = async () => {
    try {
      // Try localStorage first for instant loading
      const cachedSettings = localStorage.getItem('lastUsedSettings')
      if (cachedSettings) {
        try {
          const lastSettings = JSON.parse(cachedSettings)
          if (lastSettings && typeof lastSettings === 'object') {
            await loadSettings(lastSettings, false)
            return true
          }
        } catch (parseError) {
          console.error('Error parsing cached settings:', parseError)
        }
      }

      // Fallback to server
      const response = await settingsApi.get()
      if (response.data && response.data.last_used_settings) {
        try {
          const lastSettings = JSON.parse(response.data.last_used_settings)
          if (lastSettings && typeof lastSettings === 'object') {
            await loadSettings(lastSettings, false)
            localStorage.setItem('lastUsedSettings', JSON.stringify(lastSettings))
            return true
          }
        } catch (parseError) {
          console.error('Error parsing last_used_settings:', parseError)
        }
      }
    } catch (error) {
      console.error('Error loading last used settings:', error)
    }
    return false
  }

  /**
   * Save settings to localStorage and server.
   * Saves raw form settings BEFORE style processing.
   */
  const saveLastUsedSettings = async (settingsToSave) => {
    try {
      localStorage.setItem('lastUsedSettings', JSON.stringify(settingsToSave))

      // Also save to server (async, don't wait)
      settingsApi.update({ lastUsedSettings: settingsToSave }).catch(error => {
        console.error('Error saving settings to server:', error)
      })
    } catch (error) {
      console.error('Error saving last used settings:', error)
    }
  }

  /**
   * Load albums for the album selector.
   */
  const loadAlbums = async () => {
    try {
      const response = await albumsApi.getAll({ includeHidden: isHiddenAuthenticated.value })
      albums.value = response.data || []
    } catch (error) {
      console.error('Error loading albums:', error)
    }
  }

  /**
   * Restore saved album from localStorage.
   */
  const restoreSavedAlbum = () => {
    const savedAlbumId = localStorage.getItem('lastUsedAlbumId')
    if (savedAlbumId) {
      const albumId = parseInt(savedAlbumId, 10)
      if (albums.value.some(a => a.id === albumId)) {
        selectedAlbumId.value = albumId
      }
    }
  }

  /**
   * Set up watchers for auto-persistence.
   */
  const setupPersistenceWatchers = () => {
    // Persist editor mode
    watch(editorMode, (newMode) => {
      localStorage.setItem('generatorEditorMode', newMode)
    })

    // Reload albums when auth changes
    watch(isHiddenAuthenticated, () => {
      loadAlbums()
    })

    // Persist album selection
    watch(selectedAlbumId, (newValue) => {
      if (newValue) {
        localStorage.setItem('lastUsedAlbumId', String(newValue))
      } else {
        localStorage.removeItem('lastUsedAlbumId')
      }
    })
  }

  return {
    // Auth state
    isHiddenAuthenticated,

    // Methods
    loadSettings,
    loadLastUsedSettings,
    saveLastUsedSettings,
    loadAlbums,
    restoreSavedAlbum,
    setupPersistenceWatchers
  }
}
