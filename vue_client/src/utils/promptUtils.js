/**
 * Utility functions for handling prompts with the ### delimiter
 * The ### delimiter is used to separate positive and negative prompts
 */

const DEFAULT_DELIMITER = '###'

/**
 * Split a prompt string by the delimiter (default ###)
 * @param {string} prompt - The prompt to split
 * @param {string} delimiter - The delimiter to use (default '###')
 * @returns {Object} Object with positive and negative prompts
 */
export function splitPrompt(prompt, delimiter = DEFAULT_DELIMITER) {
  if (!prompt || typeof prompt !== 'string') {
    return { positive: '', negative: '' }
  }

  const parts = prompt.split(delimiter)

  if (parts.length === 0) {
    return { positive: '', negative: '' }
  }

  const positive = parts[0].trim()

  // Check if there's a second part and it's different from the first
  if (parts.length > 1 && parts[0] !== parts[parts.length - 1]) {
    const negative = parts[parts.length - 1].trim()
    return { positive, negative }
  }

  return { positive, negative: '' }
}

/**
 * Combine positive and negative prompts with the delimiter
 * @param {string} positive - The positive prompt
 * @param {string} negative - The negative prompt
 * @param {string} delimiter - The delimiter to use (default '###')
 * @returns {string} Combined prompt string
 */
export function combinePrompts(positive, negative, delimiter = DEFAULT_DELIMITER) {
  if (!negative || negative.trim() === '') {
    return positive
  }
  return `${positive} ${delimiter} ${negative}`
}

/**
 * Check if a prompt contains the delimiter
 * @param {string} prompt - The prompt to check
 * @param {string} delimiter - The delimiter to check for (default '###')
 * @returns {boolean} True if prompt contains delimiter
 */
export function hasDelimiter(prompt, delimiter = DEFAULT_DELIMITER) {
  if (!prompt || typeof prompt !== 'string') {
    return false
  }
  return prompt.includes(delimiter)
}

/**
 * Replace {np} placeholder in template with negative prompt
 * Handles three cases:
 * 1. If negative is empty, remove {np} placeholders
 * 2. If template already has ###, replace {np} with negative prompt
 * 3. Otherwise, replace {np} with ### + negative prompt
 *
 * @param {string} template - The template text containing {np} placeholders
 * @param {string} negative - The negative prompt
 * @param {string} delimiter - The delimiter to use (default '###')
 * @returns {string} Template with {np} replaced
 */
export function replaceNegativePlaceholder(template, negative, delimiter = DEFAULT_DELIMITER) {
  if (!template || typeof template !== 'string') {
    return template
  }

  if (!negative || negative.trim() === '') {
    // Remove {np} placeholders
    let result = template.replace(/{np},/g, '')
    result = result.replace(/{np}/g, '')
    return result
  }

  if (template.includes(delimiter)) {
    // Template already has ###, replace {np} with negative prompt
    return template.replace(/{np}/g, negative)
  }

  // Replace {np} with ### + negative prompt
  return template.replace(/{np}/g, ` ${delimiter} ${negative}`)
}

/**
 * Clean up excessive whitespace in prompts
 * @param {string} prompt - The prompt to clean
 * @returns {string} Cleaned prompt
 */
export function cleanPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return ''
  }
  return prompt.trim().replace(/\s+/g, ' ')
}
