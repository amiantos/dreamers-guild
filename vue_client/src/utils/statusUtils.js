/**
 * Utility functions for handling request status badges and display
 */

/**
 * Get the CSS class for a status badge based on request status
 * @param {string} status - The request status
 * @returns {string} The CSS class name
 */
export function getStatusClass(status) {
  if (status === 'completed') return 'status-completed'
  if (status === 'failed') return 'status-failed'
  if (status === 'submitting' || status === 'processing' || status === 'downloading') {
    return 'status-processing'
  }
  return 'status-pending'
}

/**
 * Get the display text for a status
 * @param {string} status - The request status
 * @returns {string} The display text
 */
export function getStatusText(status) {
  if (status === 'pending') return 'Pending'
  if (status === 'submitting') return 'Submitting'
  if (status === 'processing') return 'Processing'
  if (status === 'downloading') return 'Downloading'
  if (status === 'completed') return 'Completed'
  if (status === 'failed') return 'Failed'
  return status
}

/**
 * Get the icon for a status (using Font Awesome classes)
 * @param {string} status - The request status
 * @returns {string} The Font Awesome icon class
 */
export function getStatusIcon(status) {
  if (status === 'completed') return 'fa-check-circle'
  if (status === 'failed') return 'fa-exclamation-circle'
  if (status === 'submitting' || status === 'processing' || status === 'downloading') {
    return 'fa-spinner fa-spin'
  }
  return 'fa-clock'
}

/**
 * Get the color for a status
 * @param {string} status - The request status
 * @returns {string} The color hex code or CSS color
 */
export function getStatusColor(status) {
  if (status === 'completed') return '#4ade80' // Green
  if (status === 'failed') return '#f87171' // Red
  if (status === 'submitting' || status === 'processing' || status === 'downloading') {
    return '#60a5fa' // Blue
  }
  return '#aaa' // Gray
}

/**
 * Check if a status is a final state (completed or failed)
 * @param {string} status - The request status
 * @returns {boolean} True if status is final
 */
export function isFinalStatus(status) {
  return status === 'completed' || status === 'failed'
}

/**
 * Check if a status is an active/processing state
 * @param {string} status - The request status
 * @returns {boolean} True if status is active/processing
 */
export function isProcessingStatus(status) {
  return status === 'submitting' || status === 'processing' || status === 'downloading'
}
