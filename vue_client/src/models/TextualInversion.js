/**
 * SavedTextualInversion Class
 *
 * Represents a Textual Inversion (Embedding) from CivitAI that can be used in AI Horde image generation.
 * Stores all necessary metadata and provides conversion to AI Horde API format.
 */

export class ModelVersion {
  constructor(params = {}) {
    this.id = params.id || ''
    this.modelId = params.modelId || ''
    this.name = params.name || ''
    this.baseModel = params.baseModel || ''
    this.description = params.description || ''
    this.downloadUrl = params.downloadUrl || ''
    this.files = params.files || []
    this.images = params.images || []
    this.trainedWords = params.trainedWords || []
  }
}

export class Embedding {
  constructor(params = {}) {
    this.id = params.id || ''
    this.description = params.description || ''
    this.modelVersions = params.modelVersions || []
    this.name = params.name || ''
    this.nsfw = params.nsfw || false
    this.tags = params.tags || []
    this.stats = params.stats || {
      downloadCount: 0,
      ratingCount: 0,
      rating: 0,
      thumbsUpCount: 0,
      thumbsDownCount: 0
    }
  }
}

export class SavedTextualInversion extends Embedding {
  constructor(params = {}) {
    super({
      id: params.id || '',
      description: params.description || '',
      modelVersions: params.modelVersions || [],
      name: params.name || '',
      nsfw: params.nsfw || false,
      tags: params.tags || [],
      stats: params.stats || {
        downloadCount: 0,
        ratingCount: 0,
        rating: 0,
        thumbsUpCount: 0,
        thumbsDownCount: 0
      }
    })

    this._civitAiType = 'TextualInversion'
    this.versionId = params.versionId || params.id
    this.versionName = params.versionName || ''
    this.isManualEntry = params.isManualEntry || false
    this.strength = params.strength !== undefined ? params.strength : 0.0
    this.inject_ti = params.inject_ti !== undefined ? params.inject_ti : 'prompt'
  }

  /**
   * Convert to AI Horde API format
   * @returns {Object} Format: { name: versionId, strength: strength, inject_ti: inject_ti, is_version: true }
   */
  toHordeFormat() {
    const format = {
      name: String(this.versionId),
      strength: Number(this.strength),
      is_version: this.versionId !== false
    }

    // Only include inject_ti if it's not "none" (undefined when None is selected)
    if (this.inject_ti && this.inject_ti !== 'none') {
      format.inject_ti = this.inject_ti
    }

    return format
  }

  /**
   * Get the trained words / trigger words for the current version
   * @returns {Array<string>} Array of trigger words
   */
  getTrainedWords() {
    if (!this.modelVersions || this.modelVersions.length === 0) {
      return []
    }

    const currentVersion = this.modelVersions.find(v => v.id === this.versionId)
    return currentVersion?.trainedWords || []
  }

  /**
   * Get the base model for the current version
   * @returns {string} Base model name (e.g., "SD 1.5", "SDXL 1.0")
   */
  getBaseModel() {
    if (!this.modelVersions || this.modelVersions.length === 0) {
      return ''
    }

    const currentVersion = this.modelVersions.find(v => v.id === this.versionId)
    return currentVersion?.baseModel || ''
  }

  /**
   * Get the file size in MB for the current version
   * @returns {number} File size in MB
   */
  getFileSizeMB() {
    if (!this.modelVersions || this.modelVersions.length === 0) {
      return 0
    }

    const currentVersion = this.modelVersions.find(v => v.id === this.versionId)
    if (!currentVersion?.files || currentVersion.files.length === 0) {
      return 0
    }

    return (currentVersion.files[0].sizeKB / 1024).toFixed(2)
  }

  /**
   * Check if TI exceeds AI Horde size limit
   * @returns {boolean} True if file is too large (> 400MB)
   */
  exceedsSizeLimit() {
    return this.getFileSizeMB() > 400
  }

  /**
   * Create a SavedTextualInversion from a CivitAI Embedding and selected version
   * @param {Embedding} embedding - The CivitAI embedding object
   * @param {string|number} versionId - The selected model version ID
   * @param {Object} options - Optional strength and inject_ti values
   * @returns {SavedTextualInversion} New SavedTextualInversion instance
   */
  static fromEmbedding(embedding, versionId, options = {}) {
    const selectedVersion = embedding.modelVersions.find(v => v.id === versionId)

    return new SavedTextualInversion({
      ...embedding,
      versionId: versionId,
      versionName: selectedVersion?.name || '',
      strength: options.strength !== undefined ? options.strength : 0.0,
      inject_ti: options.inject_ti !== undefined ? options.inject_ti : 'prompt'
    })
  }
}

/**
 * Constants for Textual Inversion functionality
 */
export const TI_CONSTANTS = {
  MAX_RECENT_TIS: 20,
  CIVITAI_CACHE_TTL: 60 * 60 * 1000, // 60 minutes
  SEARCH_DEBOUNCE: 500, // ms
  NSFW_BLUR_THRESHOLD: 7,
  MAX_TI_SIZE_MB: 400,
  DEFAULT_STRENGTH: 0.0,
  DEFAULT_INJECT: 'prompt',
  STRENGTH_MIN: -5.0,
  STRENGTH_MAX: 5.0,
  STRENGTH_STEP: 0.05,
  INJECT_OPTIONS: [
    { value: 'prompt', label: 'Prompt' },
    { value: 'negprompt', label: 'Negative Prompt' },
    { value: 'none', label: 'None' }
  ]
}
