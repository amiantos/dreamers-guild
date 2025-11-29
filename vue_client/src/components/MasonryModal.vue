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
        <AsyncImage
          :src="getImageUrl(item.image.uuid)"
          :alt="item.image.prompt_simple"
          class="masonry-image"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { imagesApi } from '@api'
import AsyncImage from './AsyncImage.vue'

export default {
  name: 'MasonryModal',
  components: { AsyncImage },
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

    // Linear partition algorithm using dynamic programming
    // Partitions `seq` (array of aspect ratios) into `k` groups
    // minimizing the maximum sum of any group
    const linearPartition = (seq, k) => {
      const n = seq.length
      if (n === 0) return []
      if (k >= n) return seq.map((_, i) => [i])
      if (k <= 1) return [seq.map((_, i) => i)]

      // Prefix sums for O(1) range sum queries
      const prefixSum = [0]
      for (const val of seq) {
        prefixSum.push(prefixSum[prefixSum.length - 1] + val)
      }
      const rangeSum = (i, j) => prefixSum[j + 1] - prefixSum[i]

      // DP tables
      const dp = Array(n).fill(null).map(() => Array(k).fill(Infinity))
      const dividers = Array(n).fill(null).map(() => Array(k).fill(0))

      // Base case: 1 partition (all items in single group)
      for (let i = 0; i < n; i++) {
        dp[i][0] = rangeSum(0, i)
      }

      // Fill DP table
      for (let j = 1; j < k; j++) {
        for (let i = j; i < n; i++) {
          for (let x = j - 1; x < i; x++) {
            const cost = Math.max(dp[x][j - 1], rangeSum(x + 1, i))
            if (cost < dp[i][j]) {
              dp[i][j] = cost
              dividers[i][j] = x
            }
          }
        }
      }

      // Reconstruct the partition from dividers
      const result = []
      let idx = n - 1
      let part = k - 1
      while (part >= 0) {
        const start = part > 0 ? dividers[idx][part] + 1 : 0
        const row = []
        for (let i = start; i <= idx; i++) {
          row.push(i)
        }
        result.unshift(row)
        idx = part > 0 ? dividers[idx][part] : -1
        part--
      }

      return result.filter(row => row.length > 0)
    }

    // Main layout calculation
    const calculateLayout = (images, vpWidth, vpHeight) => {
      if (!images || images.length === 0) return []

      const gap = 6 // Gap between images
      const padding = 16 // Padding around the container
      const availableWidth = vpWidth - padding * 2
      const availableHeight = vpHeight - padding * 2

      // Special case: single image
      if (images.length === 1) {
        const dims = extractDimensions(images[0])
        const aspect = dims.width / dims.height
        let w, h
        if (aspect > availableWidth / availableHeight) {
          // Image is wider than viewport ratio
          w = availableWidth
          h = w / aspect
        } else {
          // Image is taller than viewport ratio
          h = availableHeight
          w = h * aspect
        }
        return [{
          image: images[0],
          style: {
            position: 'absolute',
            left: `${padding + (availableWidth - w) / 2}px`,
            top: `${padding + (availableHeight - h) / 2}px`,
            width: `${w}px`,
            height: `${h}px`
          }
        }]
      }

      // Get aspect ratios for all images
      const aspects = images.map(img => {
        const dims = extractDimensions(img)
        return dims.width / dims.height
      })

      // Calculate ideal number of rows based on viewport aspect ratio
      const totalAspect = aspects.reduce((a, b) => a + b, 0)
      const idealRowHeight = Math.sqrt((availableWidth * availableHeight) / totalAspect)
      let rowCount = Math.max(1, Math.round(availableHeight / idealRowHeight))

      // Cap row count to number of images
      rowCount = Math.min(rowCount, images.length)

      // Partition images into rows
      const rows = linearPartition(aspects, rowCount)

      // Calculate positions for each image
      const positioned = []
      let y = padding

      // First pass: calculate natural heights for each row
      const rowData = rows.map(row => {
        const rowAspect = row.reduce((sum, idx) => sum + aspects[idx], 0)
        const gapSpace = (row.length - 1) * gap
        const rowHeight = (availableWidth - gapSpace) / rowAspect
        return { indices: row, height: rowHeight, aspect: rowAspect }
      })

      // Calculate total height and scale factor
      const totalGapHeight = (rows.length - 1) * gap
      const totalNaturalHeight = rowData.reduce((sum, r) => sum + r.height, 0)
      const scale = (availableHeight - totalGapHeight) / totalNaturalHeight

      // Second pass: apply scale and position items
      for (const row of rowData) {
        const scaledHeight = row.height * scale
        let x = padding

        for (const idx of row.indices) {
          const itemWidth = scaledHeight * aspects[idx]
          positioned.push({
            image: images[idx],
            style: {
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${itemWidth}px`,
              height: `${scaledHeight}px`
            }
          })
          x += itemWidth + gap
        }
        y += scaledHeight + gap
      }

      return positioned
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

.masonry-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
