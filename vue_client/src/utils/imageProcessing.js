/**
 * Image processing utilities for img2img functionality.
 * Handles image validation, resizing, and format conversion.
 */

// Maximum file size for upload (10MB)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// Valid image MIME types
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']

/**
 * Validate that a file is an acceptable image type.
 * @param {File} file - The file to validate
 * @returns {boolean} - True if valid image type
 */
export function isValidImageType(file) {
  return VALID_IMAGE_TYPES.includes(file.type)
}

/**
 * Validate file size is within limits.
 * @param {File} file - The file to validate
 * @returns {boolean} - True if within size limit
 */
export function isValidImageSize(file) {
  return file.size <= MAX_IMAGE_SIZE
}

/**
 * Process an image file for img2img upload:
 * - Resize to target width while maintaining aspect ratio
 * - Convert to JPEG format
 * - Return base64 encoded string and preview URL
 *
 * @param {File} file - The image file to process
 * @param {number} targetWidth - Target width to resize to
 * @param {number} quality - JPEG quality (0-1), default 0.85
 * @returns {Promise<{base64: string, preview: string}>} - Base64 string (no prefix) and preview data URL
 */
export async function processImageForUpload(file, targetWidth, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        const aspectRatio = img.width / img.height
        const newWidth = targetWidth
        const newHeight = Math.round(targetWidth / aspectRatio)

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas')
        canvas.width = newWidth
        canvas.height = newHeight

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        // Convert to JPEG base64
        const base64Full = canvas.toDataURL('image/jpeg', quality)
        // Remove the data:image/jpeg;base64, prefix for API
        const base64 = base64Full.split(',')[1]

        // Keep the full data URL for preview display
        const preview = base64Full

        resolve({ base64, preview })
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert a base64 string to a Blob for storage.
 * @param {string} base64 - Base64 encoded string (without data URL prefix)
 * @param {string} mimeType - MIME type of the image, default 'image/jpeg'
 * @returns {Blob} - Blob object
 */
export function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }

  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

/**
 * Convert a Blob to base64 string.
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<string>} - Base64 encoded string (without data URL prefix)
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      // Remove the data URL prefix
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }

    reader.onerror = () => reject(new Error('Failed to convert blob to base64'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Create a preview URL from a base64 string.
 * @param {string} base64 - Base64 encoded string (without data URL prefix)
 * @param {string} mimeType - MIME type of the image, default 'image/jpeg'
 * @returns {string} - Data URL for preview
 */
export function base64ToPreviewUrl(base64, mimeType = 'image/jpeg') {
  return `data:${mimeType};base64,${base64}`
}
