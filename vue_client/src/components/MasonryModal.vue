<template>
  <div v-if="show" class="masonry-overlay" @click.self="$emit('close')">
    <button class="btn-close" @click="$emit('close')" title="Close (Esc)">
      <i class="fa-solid fa-xmark"></i>
    </button>

    <div class="masonry-container" ref="containerRef">
      <div
        v-for="item in layout"
        :key="item.image.uuid"
        class="masonry-item"
        :style="item.style"
      >
        <img
          :src="getImageUrl(item.image.uuid)"
          :alt="item.image.prompt_simple"
          :style="{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center'
          }"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { imagesApi } from '@api'

export default {
  name: 'MasonryModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    images: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const containerRef = ref(null)
    const viewportWidth = ref(window.innerWidth)
    const viewportHeight = ref(window.innerHeight)

    // Extract width/height from image's full_request JSON
    const extractDimensions = (image) => {
      if (image.full_request) {
        try {
          const request = JSON.parse(image.full_request)
          const params = request.params || {}
          return {
            width: params.width || 512,
            height: params.height || 512
          }
        } catch (e) {
          return { width: 512, height: 512 }
        }
      }
      return { width: 512, height: 512 }
    }

    // Interleave arrays for variety (landscape, portrait, square, repeat...)
    const interleaveArrays = (...arrays) => {
      const result = []
      const maxLen = Math.max(...arrays.map(a => a.length))
      for (let i = 0; i < maxLen; i++) {
        for (const arr of arrays) {
          if (i < arr.length) {
            result.push(arr[i])
          }
        }
      }
      return result
    }

    // Check if two rectangles overlap
    const rectsOverlap = (r1, r2) => {
      return !(r1.x + r1.width <= r2.x ||
               r2.x + r2.width <= r1.x ||
               r1.y + r1.height <= r2.y ||
               r2.y + r2.height <= r1.y)
    }

    // Check if rectangle is within bounds
    const isInBounds = (rect, width, height, padding) => {
      return rect.x >= padding &&
             rect.y >= padding &&
             rect.x + rect.width <= width - padding &&
             rect.y + rect.height <= height - padding
    }

    // Generate positions in spiral pattern from center
    const generateSpiralPositions = (centerX, centerY, maxRadius, step = 15) => {
      const positions = [{ x: centerX, y: centerY }]

      let radius = step
      while (radius < maxRadius) {
        // Number of points at this radius (more points as radius increases)
        const circumference = 2 * Math.PI * radius
        const numPoints = Math.max(8, Math.floor(circumference / step))

        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2
          positions.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
          })
        }
        radius += step
      }

      return positions
    }

    // Spiral packing from center
    const calculateLayout = (images, vpWidth, vpHeight) => {
      if (!images || images.length === 0) return []

      const padding = 16
      const gap = 6
      const centerX = vpWidth / 2
      const centerY = vpHeight / 2

      // Get image data with aspects
      const imageData = images.map(img => {
        const dims = extractDimensions(img)
        return {
          image: img,
          aspect: dims.width / dims.height
        }
      })

      // Categorize by aspect ratio
      const landscape = imageData.filter(img => img.aspect > 1.2)
      const portrait = imageData.filter(img => img.aspect < 0.8)
      const square = imageData.filter(img => img.aspect >= 0.8 && img.aspect <= 1.2)

      // Interleave for variety
      const ordered = interleaveArrays(landscape, portrait, square)

      const count = ordered.length
      if (count === 0) return []

      // Calculate base size - aim to fill ~70% of viewport area
      const availableArea = (vpWidth - padding * 2) * (vpHeight - padding * 2) * 0.7
      const areaPerImage = availableArea / count
      const baseSize = Math.sqrt(areaPerImage)

      // Detect canvas orientation for sizing bias
      const canvasAspect = vpWidth / vpHeight
      const isLandscapeCanvas = canvasAspect > 1.2
      const isPortraitCanvas = canvasAspect < 0.8

      // Size each image based on its aspect ratio
      const sized = ordered.map(img => {
        let w, h

        // Base dimensions from aspect ratio
        if (img.aspect >= 1) {
          w = baseSize * Math.sqrt(img.aspect)
          h = w / img.aspect
        } else {
          h = baseSize / Math.sqrt(img.aspect)
          w = h * img.aspect
        }

        // Boost size for images matching canvas orientation
        let sizeBoost = 1.0
        if (isLandscapeCanvas && img.aspect > 1.2) sizeBoost = 1.15
        if (isPortraitCanvas && img.aspect < 0.8) sizeBoost = 1.15

        w *= sizeBoost
        h *= sizeBoost

        return {
          ...img,
          width: w,
          height: h
        }
      })

      // Generate spiral positions
      const maxRadius = Math.max(vpWidth, vpHeight)
      const spiralPositions = generateSpiralPositions(centerX, centerY, maxRadius, 12)

      // Place images
      const placed = []

      for (const img of sized) {
        let wasPlaced = false
        let currentWidth = img.width
        let currentHeight = img.height

        // Try progressively smaller scales until image fits
        const scaleFactors = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3]

        for (const scale of scaleFactors) {
          if (wasPlaced) break

          currentWidth = img.width * scale
          currentHeight = img.height * scale

          for (const pos of spiralPositions) {
            const rect = {
              x: pos.x - currentWidth / 2,
              y: pos.y - currentHeight / 2,
              width: currentWidth + gap,
              height: currentHeight + gap
            }

            // Check bounds and overlaps
            if (isInBounds(rect, vpWidth, vpHeight, padding)) {
              const overlaps = placed.some(p => rectsOverlap(rect, p.rect))

              if (!overlaps) {
                placed.push({
                  image: img.image,
                  rect,
                  style: {
                    position: 'absolute',
                    left: `${rect.x}px`,
                    top: `${rect.y}px`,
                    width: `${currentWidth}px`,
                    height: `${currentHeight}px`
                  }
                })
                wasPlaced = true
                break
              }
            }
          }
        }
      }

      return placed
    }

    // Computed layout based on current images and viewport
    const layout = computed(() => {
      if (!props.show || !props.images.length) return []
      return calculateLayout(props.images, viewportWidth.value, viewportHeight.value)
    })

    // Debounce utility
    const debounce = (fn, delay) => {
      let timeout
      return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => fn(...args), delay)
      }
    }

    // Handle resize
    const handleResize = debounce(() => {
      viewportWidth.value = window.innerWidth
      viewportHeight.value = window.innerHeight
    }, 1500)

    // Handle keyboard
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        emit('close')
      }
    }

    // Get image URL
    const getImageUrl = (uuid) => {
      return imagesApi.getImageUrl(uuid)
    }

    // Lifecycle
    onMounted(() => {
      window.addEventListener('resize', handleResize)
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeydown)
    })

    // Recalculate when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal) {
        viewportWidth.value = window.innerWidth
        viewportHeight.value = window.innerHeight
      }
    })

    return {
      containerRef,
      layout,
      getImageUrl
    }
  }
}
</script>

<style scoped>
.masonry-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-modal, rgba(0, 0, 0, 0.95));
  z-index: var(--z-index-modal, 1000);
  display: flex;
  align-items: center;
  justify-content: center;
}

.masonry-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.masonry-item {
  overflow: hidden;
  border-radius: 4px;
}

.btn-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--overlay-darker, rgba(0, 0, 0, 0.6));
  color: white;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: background 0.2s ease;
}

.btn-close:hover {
  background: var(--color-danger, #ef4444);
}

@media (max-width: 640px) {
  .btn-close {
    top: 0.5rem;
    right: 0.5rem;
    width: 36px;
    height: 36px;
  }
}
</style>
