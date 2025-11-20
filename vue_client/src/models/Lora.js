/**
 * SavedLora Class
 *
 * Represents a LoRA model from CivitAI that can be used in AI Horde image generation.
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

export class SavedLora extends Embedding {
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

    this._civitAiType = 'LORA'
    this.versionId = params.versionId || params.id
    this.versionName = params.versionName || ''
    this.isArtbotManualEntry = params.isArtbotManualEntry || false
    this.strength = params.strength !== undefined ? params.strength : 1.0
    this.clip = params.clip !== undefined ? params.clip : 1.0
  }

  /**
   * Convert to AI Horde API format
   * @returns {Object} Format: { name: versionId, model: strength, clip: clip, is_version: true }
   */
  toHordeFormat() {
    return {
      name: String(this.versionId),
      model: Number(this.strength),
      clip: Number(this.clip),
      is_version: this.versionId !== false
    }
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
   * Check if LoRA exceeds AI Horde size limit
   * @returns {boolean} True if file is too large (> 400MB)
   */
  exceedsSizeLimit() {
    return this.getFileSizeMB() > 400
  }

  /**
   * Create a SavedLora from a CivitAI Embedding and selected version
   * @param {Embedding} embedding - The CivitAI embedding object
   * @param {string|number} versionId - The selected model version ID
   * @param {Object} options - Optional strength and clip values
   * @returns {SavedLora} New SavedLora instance
   */
  static fromEmbedding(embedding, versionId, options = {}) {
    const selectedVersion = embedding.modelVersions.find(v => v.id === versionId)

    return new SavedLora({
      ...embedding,
      versionId: versionId,
      versionName: selectedVersion?.name || '',
      strength: options.strength !== undefined ? options.strength : 1.0,
      clip: options.clip !== undefined ? options.clip : 1.0
    })
  }
}

/**
 * Constants for LoRA functionality
 */
export const LORA_CONSTANTS = {
  MAX_LORAS: 5,
  MAX_RECENT_LORAS: 20,
  CIVITAI_CACHE_TTL: 60 * 60 * 1000, // 60 minutes
  SEARCH_DEBOUNCE: 500, // ms
  NSFW_BLUR_THRESHOLD: 7,
  MAX_LORA_SIZE_MB: 400,
  DEFAULT_STRENGTH: 1.0,
  DEFAULT_CLIP: 1.0,
  STRENGTH_MIN: -5.0,
  STRENGTH_MAX: 5.0,
  STRENGTH_STEP: 0.05
}
