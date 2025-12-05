/**
 * Shared validation functions for API requests
 * Used by both server and demo mode to ensure consistent behavior
 */

/**
 * Custom error class for validation errors
 * Matches server error response format: { error: string, details?: string[] }
 */
export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}

/**
 * Validate request params structure
 * Matches server validation in server/routes/requests.js lines 36-76
 *
 * @param {Object} params - The full request params (contains models and nested params)
 * @returns {string[]} - Array of validation error messages (empty if valid)
 */
export function validateRequestParams(params) {
  const errors = []

  // Models is at the top level of params
  if (!Array.isArray(params.models) || params.models.length === 0) {
    errors.push('models must be a non-empty array')
  }

  // The generation parameters are nested in params.params
  const genParams = params.params
  if (!genParams) {
    errors.push('params.params is required')
    return errors
  }

  // Required numeric fields
  if (typeof genParams.width !== 'number' || genParams.width <= 0) {
    errors.push('width must be a positive number')
  }
  if (typeof genParams.height !== 'number' || genParams.height <= 0) {
    errors.push('height must be a positive number')
  }
  if (typeof genParams.steps !== 'number' || genParams.steps <= 0) {
    errors.push('steps must be a positive number')
  }
  if (typeof genParams.cfg_scale !== 'number' || genParams.cfg_scale < 0) {
    errors.push('cfg_scale must be a non-negative number')
  }

  // Required string fields
  if (typeof genParams.sampler_name !== 'string' || !genParams.sampler_name.trim()) {
    errors.push('sampler_name is required')
  }

  // Optional but validated if present
  if (genParams.n !== undefined && (typeof genParams.n !== 'number' || genParams.n <= 0)) {
    errors.push('n must be a positive number')
  }

  return errors
}

/**
 * Validate that prompt is provided and truthy
 * @param {string} prompt
 * @returns {boolean}
 */
export function validatePrompt(prompt) {
  return Boolean(prompt && typeof prompt === 'string' && prompt.trim())
}
