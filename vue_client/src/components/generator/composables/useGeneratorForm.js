import { ref, reactive, computed, nextTick } from 'vue'
import { baseDefaults } from '../../../config/presets.js'
import { splitPrompt, replaceNegativePlaceholder } from '../../../utils/promptUtils.js'
import { getLoraByVersionId, getTiById, getTiByVersionId } from '../../../api/civitai'
import { SavedLora } from '../../../models/Lora'
import { SavedTextualInversion } from '../../../models/TextualInversion'

// Injection key for child components to access form state
export const GeneratorFormKey = Symbol('GeneratorForm')

/**
 * Core composable for generator form state and methods.
 * This composable manages all form state, style handling, LoRA/TI management,
 * and dimension controls. It does NOT handle submission or persistence.
 */
export function useGeneratorForm() {
  // === UI State ===
  const submitting = ref(false)
  const showModelPicker = ref(false)
  const showLoraPicker = ref(false)
  const showLoraDetails = ref(false)
  const selectedLoraForDetails = ref(null)
  const showTiPicker = ref(false)
  const showTiDetails = ref(false)
  const selectedTiForDetails = ref(null)

  // === Aspect Ratio State ===
  const aspectLocked = ref(false)
  const aspectRatio = ref(1)

  // === Style State ===
  const selectedStyleName = ref('')
  const selectedStyleData = ref(null)
  const allStyles = ref([])
  const inlineStylePicker = ref(null)

  // === Editor Mode ===
  const editorMode = ref(localStorage.getItem('generatorEditorMode') || 'simple')
  const showStyleSwitchConfirm = ref(false)

  // === Album State ===
  const albums = ref([])
  const selectedAlbumId = ref(null)

  // === Form State ===
  const form = reactive({
    prompt: '',
    negativePrompt: '',
    model: '',
    n: 4,
    steps: 30,
    width: 1024,
    height: 1024,
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

  // === Computed Properties ===

  // Calculate GCD for aspect ratio simplification
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)

  const aspectRatioText = computed(() => {
    const divisor = gcd(form.width, form.height)
    const widthRatio = form.width / divisor
    const heightRatio = form.height / divisor
    return `Lock to ${widthRatio}:${heightRatio}`
  })

  const isFormValid = computed(() => form.prompt.trim().length > 0)

  // === Model Methods ===

  const onModelSelect = (modelName) => {
    form.model = modelName
  }

  // === Style Methods ===

  const onStyleSelect = (style) => {
    if (style) {
      selectedStyleName.value = style.name
      selectedStyleData.value = style
      localStorage.setItem('selectedStyle', JSON.stringify(style))
    }
  }

  const onStylesLoaded = (styles) => {
    allStyles.value = styles
    // If in Simple mode and no style selected, try to restore saved style
    if (editorMode.value === 'simple' && !selectedStyleName.value) {
      const savedStyle = localStorage.getItem('selectedStyle')
      if (savedStyle) {
        try {
          const style = JSON.parse(savedStyle)
          const matchingStyle = styles.find(s => s.name === style.name)
          if (matchingStyle) {
            selectedStyleName.value = matchingStyle.name
            selectedStyleData.value = matchingStyle
          } else {
            localStorage.removeItem('selectedStyle')
            selectDefaultStyle()
          }
        } catch (e) {
          console.error('Error parsing saved style:', e)
          localStorage.removeItem('selectedStyle')
          selectDefaultStyle()
        }
      } else {
        selectDefaultStyle()
      }
    }
  }

  const selectDefaultStyle = () => {
    const defaultStyle = allStyles.value.find(s => s.name === 'albedo3.1')
    if (defaultStyle) {
      onStyleSelect(defaultStyle)
    } else if (allStyles.value.length > 0) {
      onStyleSelect(allStyles.value[0])
    }
  }

  const removeStyle = () => {
    selectedStyleName.value = ''
    selectedStyleData.value = null
    localStorage.removeItem('selectedStyle')
  }

  const applyStyle = async () => {
    if (!selectedStyleData.value) return

    const style = selectedStyleData.value

    // Apply style's prompt template
    if (style.prompt) {
      const userPrompt = form.prompt || ''
      const userNegativePrompt = form.negativePrompt || ''

      let generationText = style.prompt.replace(/{p}/g, userPrompt)
      generationText = replaceNegativePlaceholder(generationText, userNegativePrompt)

      const { positive, negative } = splitPrompt(generationText)
      form.prompt = positive
      form.negativePrompt = negative
    }

    // Apply style parameters
    if (style.model) form.model = style.model
    if (style.steps !== undefined) form.steps = style.steps
    if (style.width !== undefined) form.width = style.width
    if (style.height !== undefined) form.height = style.height
    if (style.cfg_scale !== undefined) form.cfgScale = style.cfg_scale
    if (style.sampler_name) form.sampler = style.sampler_name
    if (style.karras !== undefined) form.karras = style.karras
    if (style.hires_fix !== undefined) form.hiresFix = style.hires_fix
    if (style.hires_fix_denoising_strength !== undefined) {
      form.hiresFixDenoisingStrength = style.hires_fix_denoising_strength
    }
    if (style.tiling !== undefined) form.tiling = style.tiling
    if (style.clip_skip !== undefined) form.clipSkip = style.clip_skip
    if (style.loras && Array.isArray(style.loras)) {
      form.loras = await enrichLoras(style.loras)
    } else {
      form.loras = []
    }

    // Clear post-processing when style is applied
    form.faceFix = 'none'
    form.faceFixStrength = 0.5
    form.upscaler = 'none'
    form.stripBackground = false

    removeStyle()
  }

  // === Editor Mode Methods ===

  const toggleEditorMode = () => {
    if (editorMode.value === 'simple' && selectedStyleName.value) {
      showStyleSwitchConfirm.value = true
    } else {
      editorMode.value = editorMode.value === 'simple' ? 'advanced' : 'simple'
    }
  }

  const confirmSwitchToAdvanced = async (shouldApplyStyle) => {
    if (shouldApplyStyle) {
      await applyStyle()
    } else {
      removeStyle()
    }
    editorMode.value = 'advanced'
    showStyleSwitchConfirm.value = false
  }

  // === Dimension Methods ===

  const onAspectLockToggle = () => {
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

  const swapDimensions = () => {
    const temp = form.width
    form.width = form.height
    form.height = temp
    if (aspectLocked.value) {
      aspectRatio.value = form.width / form.height
    }
  }

  // === LoRA Methods ===

  const addLora = (lora) => {
    form.loras.push(lora)
  }

  const removeLora = (index) => {
    form.loras.splice(index, 1)
  }

  const onLoraStrengthChange = (index) => {
    const rounded = Math.round(form.loras[index].strength * 20) / 20
    form.loras[index].strength = parseFloat(rounded.toFixed(2))
  }

  const onLoraClipChange = (index) => {
    const rounded = Math.round(form.loras[index].clip * 20) / 20
    form.loras[index].clip = parseFloat(rounded.toFixed(2))
  }

  const currentLoraVersion = (lora) => {
    if (!lora.modelVersions || lora.modelVersions.length === 0) return null
    return lora.modelVersions.find(v => v.id === lora.versionId) || lora.modelVersions[0]
  }

  const loraTrainedWords = (lora) => {
    const version = currentLoraVersion(lora)
    if (!version || !version.trainedWords) return []
    return version.trainedWords
  }

  const addTriggerWord = (word) => {
    const textarea = document.getElementById('prompt')
    if (!textarea) {
      form.prompt = form.prompt ? `${form.prompt} ${word}` : word
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentPrompt = form.prompt || ''

    const beforeCursor = currentPrompt.substring(0, start)
    const afterCursor = currentPrompt.substring(end)

    const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ')
    const needsSpaceAfter = afterCursor.length > 0 && !afterCursor.startsWith(' ')

    const wordToInsert = (needsSpaceBefore ? ' ' : '') + word + (needsSpaceAfter ? ' ' : '')
    form.prompt = beforeCursor + wordToInsert + afterCursor

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
    const index = form.loras.findIndex(lora => lora.versionId === versionId)
    if (index !== -1) removeLora(index)
  }

  const enrichLoras = async (loras) => {
    if (!loras || !Array.isArray(loras) || loras.length === 0) return []

    const enrichedLoras = []
    const enrichmentMap = {}

    // First pass: identify minimal LoRAs that need enrichment
    const minimalLoras = loras.filter(lora => lora.name && !lora.versionId && !lora.modelVersions)

    // Fetch enrichment data
    for (const lora of minimalLoras) {
      const versionId = lora.name
      try {
        const modelData = await getLoraByVersionId(versionId)
        if (modelData) enrichmentMap[versionId] = modelData
      } catch (error) {
        console.warn(`Could not fetch LoRA version ${versionId}:`, error)
      }
    }

    // Second pass: reconstruct enriched array
    for (const lora of loras) {
      const isMinimal = lora.name && !lora.versionId && !lora.modelVersions

      if (isMinimal) {
        const versionId = lora.name
        const cached = enrichmentMap[versionId]

        if (cached) {
          enrichedLoras.push(new SavedLora({
            ...cached,
            versionId: Number(versionId),
            strength: lora.model || 1.0,
            clip: lora.clip || 1.0
          }))
        } else {
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
        enrichedLoras.push(lora)
      }
    }

    return enrichedLoras
  }

  // === Textual Inversion Methods ===

  const addTi = (ti) => {
    form.tis.push(ti)
  }

  const removeTi = (index) => {
    form.tis.splice(index, 1)
  }

  const onTiStrengthChange = (index) => {
    const rounded = Math.round(form.tis[index].strength * 20) / 20
    form.tis[index].strength = parseFloat(rounded.toFixed(2))
  }

  const onTiInjectChange = (index) => {
    // No-op, but available for future use
  }

  const currentTiVersion = (ti) => {
    if (!ti.modelVersions || ti.modelVersions.length === 0) return null
    return ti.modelVersions.find(v => v.id == ti.versionId) || ti.modelVersions[0]
  }

  const tiTrainedWords = (ti) => {
    const version = currentTiVersion(ti)
    if (!version || !version.trainedWords) return []
    return version.trainedWords
  }

  const showTiInfo = async (ti) => {
    try {
      const fullModelData = await getTiById(ti.id)
      selectedTiForDetails.value = fullModelData
      showTiDetails.value = true
    } catch (error) {
      console.error('[showTiInfo] Error fetching by model ID:', error)

      if (ti.versionId) {
        try {
          const fullModelData = await getTiByVersionId(ti.versionId)
          fullModelData.versionId = ti.versionId
          selectedTiForDetails.value = fullModelData
          showTiDetails.value = true
          return
        } catch (versionError) {
          console.error('[showTiInfo] Error fetching by version ID:', versionError)
        }
      }

      selectedTiForDetails.value = ti
      showTiDetails.value = true
    }
  }

  const removeTiFromDetails = (versionId) => {
    const index = form.tis.findIndex(ti => ti.versionId === versionId)
    if (index !== -1) removeTi(index)
  }

  const enrichTis = async (tis) => {
    if (!tis || !Array.isArray(tis) || tis.length === 0) return []

    const enriched = []
    for (const ti of tis) {
      try {
        const versionId = ti.versionId || ti.name
        if (versionId) {
          const fullData = await getTiByVersionId(versionId)
          const enrichedTi = SavedTextualInversion.fromEmbedding(fullData, versionId, {
            strength: ti.strength || 0.0,
            inject_ti: ti.inject_ti !== undefined ? ti.inject_ti : 'none'
          })
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

  // === Form Reset ===

  const resetFormToDefaults = () => {
    Object.assign(form, { ...baseDefaults })
    form.loras = []
    form.tis = []
  }

  // === UI Helpers ===

  const getSliderBackground = (value, min, max) => {
    const percentage = ((value - min) / (max - min)) * 100
    return `linear-gradient(to right, #587297 0%, #587297 ${percentage}%, #333 ${percentage}%, #333 100%)`
  }

  const autoExpand = (event) => {
    const textarea = event.target
    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'
  }

  return {
    // Form state
    form,
    submitting,

    // UI state - pickers
    showModelPicker,
    showLoraPicker,
    showLoraDetails,
    selectedLoraForDetails,
    showTiPicker,
    showTiDetails,
    selectedTiForDetails,

    // Aspect ratio
    aspectLocked,
    aspectRatio,
    aspectRatioText,

    // Style state
    selectedStyleName,
    selectedStyleData,
    allStyles,
    inlineStylePicker,

    // Editor mode
    editorMode,
    showStyleSwitchConfirm,

    // Album state
    albums,
    selectedAlbumId,

    // Computed
    isFormValid,

    // Model methods
    onModelSelect,

    // Style methods
    onStyleSelect,
    onStylesLoaded,
    selectDefaultStyle,
    removeStyle,
    applyStyle,

    // Editor mode methods
    toggleEditorMode,
    confirmSwitchToAdvanced,

    // Dimension methods
    onAspectLockToggle,
    onDimensionChange,
    swapDimensions,

    // LoRA methods
    addLora,
    removeLora,
    onLoraStrengthChange,
    onLoraClipChange,
    currentLoraVersion,
    loraTrainedWords,
    addTriggerWord,
    showLoraInfo,
    removeLoraFromDetails,
    enrichLoras,

    // TI methods
    addTi,
    removeTi,
    onTiStrengthChange,
    onTiInjectChange,
    currentTiVersion,
    tiTrainedWords,
    showTiInfo,
    removeTiFromDetails,
    enrichTis,

    // Form methods
    resetFormToDefaults,

    // UI helpers
    getSliderBackground,
    autoExpand
  }
}
