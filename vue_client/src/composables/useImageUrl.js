import { ref, watch, onUnmounted } from 'vue'

const isDemo = typeof __DEMO_MODE__ !== 'undefined' && __DEMO_MODE__

/**
 * Composable for resolving image URLs
 * In normal mode: Returns URLs directly
 * In demo mode: Resolves blob URLs from IndexedDB
 */
export function useImageUrl(imageId, type = 'thumbnail') {
  const url = ref(null)
  const loading = ref(false)
  const error = ref(null)

  let currentBlobUrl = null

  const resolveUrl = async (id) => {
    if (!id) {
      url.value = null
      return
    }

    if (!isDemo) {
      // In normal mode, import and use imagesApi directly
      const { imagesApi } = await import('@api')
      url.value = type === 'thumbnail'
        ? imagesApi.getThumbnailUrl(id)
        : imagesApi.getImageUrl(id)
      return
    }

    // In demo mode, resolve blob URL from IndexedDB
    loading.value = true
    error.value = null

    try {
      const { resolveBlobUrl } = await import('@api')
      const blobUrlScheme = type === 'thumbnail'
        ? `demo-blob://thumbnail/${id}`
        : `demo-blob://image/${id}`

      const resolvedUrl = await resolveBlobUrl(blobUrlScheme)

      // Revoke previous blob URL to prevent memory leaks
      if (currentBlobUrl && currentBlobUrl !== resolvedUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }

      currentBlobUrl = resolvedUrl
      url.value = resolvedUrl
    } catch (err) {
      console.error('Error resolving blob URL:', err)
      error.value = err.message
      url.value = null
    } finally {
      loading.value = false
    }
  }

  // Watch for imageId changes
  if (typeof imageId === 'object' && 'value' in imageId) {
    // It's a ref
    watch(imageId, (newId) => resolveUrl(newId), { immediate: true })
  } else {
    // It's a static value
    resolveUrl(imageId)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl)
    }
  })

  return {
    url,
    loading,
    error,
    refresh: () => resolveUrl(typeof imageId === 'object' ? imageId.value : imageId)
  }
}

/**
 * Simple synchronous URL getter for non-reactive use cases
 * Returns a demo-blob:// URL in demo mode, or direct URL in normal mode
 */
export function getImageUrl(imageId, type = 'thumbnail') {
  if (!isDemo) {
    // This will be tree-shaken in demo builds
    const baseURL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:8005/api')
    return type === 'thumbnail'
      ? `${baseURL}/images/${imageId}/thumbnail`
      : `${baseURL}/images/${imageId}/file`
  }

  // Return demo-blob URL scheme that needs resolution
  return type === 'thumbnail'
    ? `demo-blob://thumbnail/${imageId}`
    : `demo-blob://image/${imageId}`
}

/**
 * Check if we're in demo mode
 */
export function isDemoMode() {
  return isDemo
}

export default {
  useImageUrl,
  getImageUrl,
  isDemoMode
}
