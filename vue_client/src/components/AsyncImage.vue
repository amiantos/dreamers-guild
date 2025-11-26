<template>
  <img
    v-if="resolvedUrl"
    :src="resolvedUrl"
    :alt="alt"
    :loading="loading"
    :class="$attrs.class"
    @error="handleImageError"
  />
  <div v-else-if="isLoading" class="async-image-loading">
    <slot name="loading">
      <div class="loading-placeholder"></div>
    </slot>
  </div>
  <div v-else class="async-image-error">
    <slot name="error">
      <div class="error-placeholder"></div>
    </slot>
  </div>
</template>

<script>
import { ref, watch, onUnmounted } from 'vue'

const isDemo = typeof __DEMO_MODE__ !== 'undefined' && __DEMO_MODE__

export default {
  name: 'AsyncImage',
  inheritAttrs: false,
  props: {
    src: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: ''
    },
    loading: {
      type: String,
      default: 'lazy'
    }
  },
  setup(props) {
    const resolvedUrl = ref(null)
    const isLoading = ref(false)
    const error = ref(null)
    let currentBlobUrl = null

    const resolveUrl = async (url) => {
      if (!url) {
        resolvedUrl.value = null
        return
      }

      // If not demo mode or not a demo-blob URL, use directly
      if (!isDemo || !url.startsWith('demo-blob://')) {
        resolvedUrl.value = url
        return
      }

      // In demo mode, resolve the blob URL
      isLoading.value = true
      error.value = null

      try {
        const { resolveBlobUrl } = await import('@api')
        const resolved = await resolveBlobUrl(url)

        if (!resolved) {
          throw new Error('Failed to resolve blob URL')
        }

        // Revoke previous blob URL to prevent memory leaks
        if (currentBlobUrl && currentBlobUrl !== resolved) {
          URL.revokeObjectURL(currentBlobUrl)
        }

        currentBlobUrl = resolved
        resolvedUrl.value = resolved
      } catch (err) {
        console.error('Error resolving blob URL:', err)
        error.value = err.message
        resolvedUrl.value = null
      } finally {
        isLoading.value = false
      }
    }

    watch(() => props.src, (newSrc) => {
      resolveUrl(newSrc)
    }, { immediate: true })

    // Handle image load errors (stale blob URLs after HMR)
    const handleImageError = () => {
      if (isDemo && props.src?.startsWith('demo-blob://')) {
        // Clear the cache entry and re-resolve
        const id = props.src.split('/').pop()
        const type = props.src.includes('thumbnail') ? 'thumbnail' : 'image'
        import('@api').then(({ revokeBlobUrl }) => {
          revokeBlobUrl(`${type}-${id}`)
          currentBlobUrl = null
          resolveUrl(props.src)
        })
      }
    }

    onUnmounted(() => {
      // Don't revoke - let the cache manage blob URLs
      currentBlobUrl = null
    })

    return {
      resolvedUrl,
      isLoading,
      error,
      handleImageError
    }
  }
}
</script>

<style scoped>
.async-image-loading,
.async-image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--color-surface, #1a1a1a);
}

.loading-placeholder {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border, #333);
  border-top-color: var(--color-primary, #00d4ff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-placeholder {
  width: 24px;
  height: 24px;
  color: var(--color-text-disabled, #666);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
