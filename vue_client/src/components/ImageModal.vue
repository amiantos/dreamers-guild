<template>
  <div class="lightbox-overlay" @click.self="$emit('close')">
    <div class="lightbox-container">
      <!-- Main content area -->
      <div class="lightbox-content">
        <!-- Left side: Image + Filmstrip -->
        <div class="image-area">
          <!-- Close button (inside image area to avoid sidebar overlap) -->
          <button class="btn-close" @click="$emit('close')" title="Close (Esc)">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <!-- Main image display -->
          <div class="image-display" :class="{ 'protected': isProtected }">
            <img :src="imageUrl" :alt="image.prompt_simple" />
            <!-- Protection overlay -->
            <div v-if="isProtected" class="protection-overlay">
              <div class="protection-content">
                <i class="fa-solid fa-lock"></i>
                <h3>Hidden Image</h3>
                <p>This image is protected. Enter your PIN to view it.</p>
                <button @click="handleUnlock" class="btn btn-unlock">
                  <i class="fa-solid fa-unlock"></i> Enter PIN
                </button>
              </div>
            </div>
          </div>

          <!-- Filmstrip navigation -->
          <div v-if="showFilmstrip && !isProtected" class="filmstrip">
            <button
              class="filmstrip-nav filmstrip-prev"
              @click="scrollFilmstrip(-1)"
              :disabled="!canScrollPrev"
              title="Scroll left"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div class="filmstrip-track" ref="filmstripTrack">
              <div
                v-for="(img, index) in images"
                :key="img.uuid"
                class="filmstrip-thumb"
                :class="{ active: img.uuid === image.uuid }"
                @click="navigateToImage(index)"
              >
                <img :src="getThumbnailUrl(img.uuid)" :alt="img.prompt_simple || 'Thumbnail'" />
              </div>
            </div>
            <button
              class="filmstrip-nav filmstrip-next"
              @click="scrollFilmstrip(1)"
              :disabled="!canScrollNext"
              title="Scroll right"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <!-- Right side: Inspector Sidebar -->
        <aside v-if="!isProtected" class="inspector-sidebar">
          <div class="inspector-content">
            <!-- Prompt Section -->
            <AccordionSection title="Prompt" icon="fa-font" :defaultOpen="true" :forceOpen="isDesktop">
              <div class="prompt-display">
                <p v-if="image.prompt_simple">{{ image.prompt_simple }}</p>
                <p v-else class="no-data">No prompt available</p>
              </div>
            </AccordionSection>

            <!-- Negative Prompt Section (only if there is one) -->
            <AccordionSection
              v-if="negativePrompt"
              title="Negative Prompt"
              icon="fa-ban"
              :defaultOpen="false"
            >
              <div class="prompt-display negative">
                <p>{{ negativePrompt }}</p>
              </div>
            </AccordionSection>

            <!-- Generation Settings Section -->
            <AccordionSection title="Generation" icon="fa-sliders" :defaultOpen="true" :forceOpen="isDesktop">
              <InspectorGrid v-if="generationSettings.length" :items="generationSettings" />
              <p v-else class="no-data">No generation data available</p>
            </AccordionSection>

            <!-- Model & LoRAs Section -->
            <AccordionSection title="Model & LoRAs" icon="fa-cube" :defaultOpen="false" :forceOpen="isDesktop">
              <div class="model-info">
                <span class="model-label">Model</span>
                <span class="model-name">{{ modelName }}</span>
              </div>
              <div v-if="parsedLoras.length" class="loras-list">
                <div class="loras-header">LoRAs</div>
                <div v-for="lora in parsedLoras" :key="lora.name" class="lora-item">
                  <span class="lora-name">{{ lora.name }}</span>
                  <span class="lora-strength">{{ lora.model }} / {{ lora.clip }}</span>
                </div>
              </div>
              <div v-if="parsedTis.length" class="tis-list">
                <div class="tis-header">Textual Inversions</div>
                <div v-for="ti in parsedTis" :key="ti.name" class="ti-item">
                  <span class="ti-name">{{ ti.name }}</span>
                  <span class="ti-strength">{{ ti.strength }}</span>
                </div>
              </div>
              <p v-if="!parsedLoras.length && !parsedTis.length && modelName === 'Unknown'" class="no-data">
                No model data available
              </p>
            </AccordionSection>

            <!-- Dimensions Section -->
            <AccordionSection title="Dimensions" icon="fa-expand" :defaultOpen="false" :forceOpen="isDesktop">
              <InspectorGrid v-if="dimensionSettings.length" :items="dimensionSettings" />
              <p v-else class="no-data">No dimension data available</p>
            </AccordionSection>

            <!-- Info Section -->
            <AccordionSection title="Info" icon="fa-info-circle" :defaultOpen="false" :forceOpen="isDesktop">
              <InspectorGrid :items="metadataInfo" />
            </AccordionSection>

            <!-- Actions Section -->
            <AccordionSection title="Actions" icon="fa-gear" :defaultOpen="true" :forceOpen="true">
              <!-- Action buttons -->
              <div class="action-buttons">
                <!-- Favorite / Hide row -->
                <div class="action-row">
                  <button
                    @click="toggleFavorite"
                    :class="['btn-action btn-secondary', { 'active': isFavorite }]"
                    :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
                  >
                    <i class="fa-star" :class="isFavorite ? 'fa-solid' : 'fa-regular'"></i>
                    <span>{{ isFavorite ? 'Favorited' : 'Favorite' }}</span>
                  </button>
                  <button
                    @click="toggleHidden"
                    :class="['btn-action btn-secondary', { 'active-hide': isHidden }]"
                    :title="isHidden ? 'Unhide image' : 'Hide image'"
                  >
                    <i :class="isHidden ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'"></i>
                    <span>{{ isHidden ? 'Hidden' : 'Hide' }}</span>
                  </button>
                </div>
                <!-- Load settings row -->
                <div v-if="hasSettings" class="action-row">
                  <button
                    @click="$emit('load-settings', false)"
                    class="btn-action btn-secondary"
                    title="Load generation settings from this image"
                  >
                    <i class="fa-solid fa-sliders"></i>
                    <span>Load Settings</span>
                  </button>
                  <button
                    @click="$emit('load-settings', true)"
                    class="btn-action btn-secondary"
                    title="Load generation settings including seed"
                  >
                    <i class="fa-solid fa-seedling"></i>
                    <span>+ Seed</span>
                  </button>
                </div>
                <!-- Request / Response row -->
                <div v-if="hasSettings || hasResponse" class="action-row">
                  <button
                    v-if="hasSettings"
                    @click="showDetailsView('request')"
                    class="btn-action btn-secondary"
                    title="View full request JSON"
                  >
                    <i class="fa-solid fa-code"></i>
                    <span>Request</span>
                  </button>
                  <button
                    v-if="hasResponse"
                    @click="showDetailsView('response')"
                    class="btn-action btn-secondary"
                    title="View full response JSON"
                  >
                    <i class="fa-solid fa-file-code"></i>
                    <span>Response</span>
                  </button>
                </div>
                <a
                  :href="imageUrl"
                  :download="`aislingeach-${image.uuid}.png`"
                  class="btn-action btn-primary"
                >
                  <i class="fa-solid fa-download"></i>
                  <span>Download</span>
                </a>
                <button
                  @click="showDeleteModal = true"
                  class="btn-action btn-delete"
                  title="Delete image"
                >
                  <i class="fa-solid fa-trash"></i>
                  <span>Delete</span>
                </button>
              </div>
            </AccordionSection>
          </div>
        </aside>
      </div>

      <!-- Delete Confirmation Modal -->
      <DeleteImageModal
        v-if="showDeleteModal"
        @close="showDeleteModal = false"
        @delete="confirmDelete"
      />

      <!-- Details Overlay -->
      <div v-if="showDetails" class="request-details-overlay">
        <div class="request-details-header">
          <h3>{{ detailsTitle }}</h3>
          <div class="header-actions">
            <button class="btn-copy" @click="copyToClipboard" :title="copyButtonText">
              <i :class="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'"></i>
              {{ copyButtonText }}
            </button>
            <button class="btn-close-details" @click="closeDetails">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="request-details-body">
          <pre>{{ currentDetailsContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onUnmounted, inject, nextTick } from 'vue'
import { imagesApi } from '../api/client.js'
import DeleteImageModal from './DeleteImageModal.vue'
import AccordionSection from './AccordionSection.vue'
import InspectorGrid from './InspectorGrid.vue'

export default {
  name: 'ImageModal',
  components: {
    DeleteImageModal,
    AccordionSection,
    InspectorGrid
  },
  props: {
    image: {
      type: Object,
      required: true
    },
    images: {
      type: Array,
      default: () => []
    },
    currentIndex: {
      type: Number,
      default: -1
    },
    canNavigatePrev: {
      type: Boolean,
      default: true
    },
    canNavigateNext: {
      type: Boolean,
      default: true
    }
  },
  emits: ['close', 'delete', 'navigate', 'load-settings', 'update'],
  setup(props, { emit }) {
    const isFavorite = ref(!!props.image.is_favorite)
    const isHidden = ref(!!props.image.is_hidden)
    const checkHiddenAuth = inject('checkHiddenAuth')
    const requestHiddenAccess = inject('requestHiddenAccess')
    const showDetails = ref(false)
    const detailsType = ref('request')
    const copied = ref(false)
    const showDeleteModal = ref(false)
    const filmstripTrack = ref(null)
    const canScrollPrev = ref(false)
    const canScrollNext = ref(false)
    const isDesktop = ref(window.innerWidth > 1024)

    // Watch for prop changes when navigating between images
    watch(() => props.image, (newImage) => {
      isFavorite.value = !!newImage.is_favorite
      isHidden.value = !!newImage.is_hidden
      scrollToActiveThumb()
    })

    const imageUrl = computed(() => {
      return imagesApi.getImageUrl(props.image.uuid)
    })

    const getThumbnailUrl = (uuid) => {
      return imagesApi.getThumbnailUrl(uuid)
    }

    // Check if current image is in the images array
    const isImageInArray = computed(() => {
      return props.images.some(img => img.uuid === props.image.uuid)
    })

    const showNavigation = computed(() => {
      return props.images.length > 1 && isImageInArray.value
    })

    const showFilmstrip = computed(() => {
      return props.images.length > 1 && isImageInArray.value
    })

    const currentImageIndex = computed(() => {
      return props.images.findIndex(img => img.uuid === props.image.uuid)
    })

    // Parse full_request JSON
    const parsedRequest = computed(() => {
      if (!props.image.full_request) return null
      try {
        return JSON.parse(props.image.full_request)
      } catch (e) {
        return null
      }
    })

    // Parse full_response JSON
    const parsedResponse = computed(() => {
      if (!props.image.full_response) return null
      try {
        return JSON.parse(props.image.full_response)
      } catch (e) {
        return null
      }
    })

    const parsedParams = computed(() => {
      return parsedRequest.value?.params || {}
    })

    const modelName = computed(() => {
      const models = parsedRequest.value?.models
      if (models && models.length > 0) {
        return models[0]
      }
      return 'Unknown'
    })

    // Full prompt from parsed request
    const fullPrompt = computed(() => {
      return parsedRequest.value?.prompt || props.image.prompt_simple || ''
    })

    // Negative prompt (part after ###)
    const negativePrompt = computed(() => {
      const full = fullPrompt.value
      if (!full) return ''
      const parts = full.split('###')
      if (parts.length > 1) {
        return parts[1].trim()
      }
      return ''
    })

    const parsedLoras = computed(() => {
      const loras = parsedRequest.value?.params?.loras || []
      return loras.map(lora => ({
        name: lora.name,
        model: lora.model ?? 1,
        clip: lora.clip ?? 1,
        isVersion: lora.is_version ?? false
      }))
    })

    const parsedTis = computed(() => {
      const tis = parsedRequest.value?.params?.tis || []
      return tis.map(ti => ({
        name: ti.name,
        strength: ti.strength ?? 1
      }))
    })

    // Format sampler name nicely
    const formatSamplerName = (name) => {
      if (!name) return '-'
      return name.replace('k_', '').replace(/_/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }

    // Calculate aspect ratio
    const calculateAspect = (w, h) => {
      if (!w || !h) return '-'
      const gcd = (a, b) => b ? gcd(b, a % b) : a
      const divisor = gcd(w, h)
      return `${w / divisor}:${h / divisor}`
    }

    // Generation settings for InspectorGrid
    const generationSettings = computed(() => {
      const params = parsedParams.value
      const response = parsedResponse.value

      if (!params || Object.keys(params).length === 0) return []

      const items = [
        { label: 'Steps', value: params.steps || '-' },
        { label: 'CFG Scale', value: params.cfg_scale || '-' },
        { label: 'Sampler', value: formatSamplerName(params.sampler_name) },
        { label: 'Seed', value: response?.seed || params.seed || '-', class: 'highlight' }
      ]

      if (params.karras !== undefined) {
        items.push({ label: 'Karras', value: params.karras ? 'Yes' : 'No' })
      }
      if (params.clip_skip !== undefined && params.clip_skip !== 1) {
        items.push({ label: 'CLIP Skip', value: params.clip_skip })
      }
      if (params.hires_fix) {
        items.push({ label: 'Hires Fix', value: 'Yes' })
        if (params.hires_fix_denoising_strength) {
          items.push({ label: 'Hires Denoise', value: params.hires_fix_denoising_strength })
        }
      }
      if (params.denoising_strength && params.denoising_strength !== 0.5) {
        items.push({ label: 'Denoise', value: params.denoising_strength })
      }

      return items
    })

    // Dimension settings for InspectorGrid
    const dimensionSettings = computed(() => {
      const params = parsedParams.value
      if (!params.width && !params.height) return []

      return [
        { label: 'Width', value: `${params.width || '-'}px` },
        { label: 'Height', value: `${params.height || '-'}px` },
        { label: 'Aspect', value: calculateAspect(params.width, params.height) }
      ]
    })

    // Metadata info for InspectorGrid
    const metadataInfo = computed(() => {
      const items = [
        { label: 'Created', value: formatDate(props.image.date_created) }
      ]
      if (props.image.backend) {
        items.push({ label: 'Backend', value: props.image.backend })
      }
      items.push({ label: 'UUID', value: props.image.uuid?.slice(0, 8) + '...', class: 'muted' })
      return items
    })

    const hasSettings = computed(() => {
      return props.image.full_request && props.image.full_request.trim() !== ''
    })

    const hasResponse = computed(() => {
      return props.image.full_response && props.image.full_response.trim() !== ''
    })

    const formattedRequest = computed(() => {
      if (!props.image.full_request) return ''
      try {
        return JSON.stringify(JSON.parse(props.image.full_request), null, 2)
      } catch (e) {
        return props.image.full_request
      }
    })

    const formattedResponse = computed(() => {
      if (!props.image.full_response) return ''
      try {
        return JSON.stringify(JSON.parse(props.image.full_response), null, 2)
      } catch (e) {
        return props.image.full_response
      }
    })

    const detailsTitle = computed(() => {
      return detailsType.value === 'request' ? 'Request Details' : 'Response Details'
    })

    const currentDetailsContent = computed(() => {
      return detailsType.value === 'request' ? formattedRequest.value : formattedResponse.value
    })

    const copyButtonText = computed(() => {
      return copied.value ? 'Copied!' : 'Copy'
    })

    const showDetailsView = (type) => {
      detailsType.value = type
      showDetails.value = true
      copied.value = false
    }

    const closeDetails = () => {
      showDetails.value = false
      copied.value = false
    }

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(currentDetailsContent.value)
        copied.value = true
        setTimeout(() => {
          copied.value = false
        }, 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        alert('Failed to copy to clipboard')
      }
    }

    const formatDate = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleString()
    }

    const toggleFavorite = async () => {
      try {
        const newValue = !isFavorite.value
        await imagesApi.update(props.image.uuid, { isFavorite: newValue })
        isFavorite.value = newValue
        props.image.is_favorite = newValue ? 1 : 0
        emit('update', { uuid: props.image.uuid, is_favorite: newValue ? 1 : 0 })
      } catch (error) {
        console.error('Error toggling favorite:', error)
        alert('Failed to update favorite status')
      }
    }

    const toggleHidden = async () => {
      try {
        const newValue = !isHidden.value
        await imagesApi.update(props.image.uuid, { isHidden: newValue })
        isHidden.value = newValue
        props.image.is_hidden = newValue ? 1 : 0
        emit('update', { uuid: props.image.uuid, is_hidden: newValue ? 1 : 0 })
      } catch (error) {
        console.error('Error toggling hidden:', error)
        alert('Failed to update hidden status')
      }
    }

    // Filmstrip navigation
    const navigateToImage = (index) => {
      if (index >= 0 && index < props.images.length) {
        const direction = index - currentImageIndex.value
        if (direction !== 0) {
          emit('navigate', direction)
        }
      }
    }

    const scrollFilmstrip = (direction) => {
      if (!filmstripTrack.value) return
      const scrollAmount = 200
      filmstripTrack.value.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
      })
    }

    const updateScrollButtons = () => {
      if (!filmstripTrack.value) return
      const { scrollLeft, scrollWidth, clientWidth } = filmstripTrack.value
      canScrollPrev.value = scrollLeft > 0
      canScrollNext.value = scrollLeft + clientWidth < scrollWidth - 1
    }

    const scrollToActiveThumb = () => {
      if (!filmstripTrack.value) return

      nextTick(() => {
        const activeThumb = filmstripTrack.value?.querySelector('.filmstrip-thumb.active')
        if (activeThumb) {
          activeThumb.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          })
        }
        updateScrollButtons()
      })
    }

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        if (showDetails.value) {
          closeDetails()
        } else {
          emit('close')
        }
      } else if (e.key === 'ArrowLeft') {
        if (showNavigation.value && props.canNavigatePrev) {
          emit('navigate', -1)
        }
      } else if (e.key === 'ArrowRight') {
        if (showNavigation.value && props.canNavigateNext) {
          emit('navigate', 1)
        }
      } else if (e.key === 'Home' && showNavigation.value) {
        navigateToImage(0)
      } else if (e.key === 'End' && showNavigation.value) {
        navigateToImage(props.images.length - 1)
      }
    }

    // Check if image should be protected
    const isProtected = computed(() => {
      return props.image.is_hidden && checkHiddenAuth && !checkHiddenAuth()
    })

    const handleUnlock = () => {
      if (requestHiddenAccess) {
        requestHiddenAccess(() => {
          // Image will automatically become visible once authenticated
        })
      }
    }

    const confirmDelete = () => {
      showDeleteModal.value = false
      emit('delete', props.image.uuid)
    }

    const handleResize = () => {
      isDesktop.value = window.innerWidth > 1024
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
      window.addEventListener('resize', handleResize)
      scrollToActiveThumb()

      // Set up scroll listener for filmstrip
      if (filmstripTrack.value) {
        filmstripTrack.value.addEventListener('scroll', updateScrollButtons)
        updateScrollButtons()
      }
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', handleResize)
      if (filmstripTrack.value) {
        filmstripTrack.value.removeEventListener('scroll', updateScrollButtons)
      }
    })

    return {
      imageUrl,
      getThumbnailUrl,
      showNavigation,
      showFilmstrip,
      hasSettings,
      hasResponse,
      formatDate,
      isFavorite,
      isHidden,
      toggleFavorite,
      toggleHidden,
      isProtected,
      handleUnlock,
      showDetails,
      detailsType,
      detailsTitle,
      currentDetailsContent,
      showDetailsView,
      closeDetails,
      copyToClipboard,
      copied,
      copyButtonText,
      showDeleteModal,
      confirmDelete,
      // Parsed data
      negativePrompt,
      modelName,
      parsedLoras,
      parsedTis,
      generationSettings,
      dimensionSettings,
      metadataInfo,
      // Filmstrip
      filmstripTrack,
      navigateToImage,
      scrollFilmstrip,
      canScrollPrev,
      canScrollNext,
      // Responsive
      isDesktop
    }
  }
}
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.lightbox-container {
  position: relative;
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  max-height: 90vh;
  background: var(--color-surface);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.btn-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--overlay-darker);
  color: white;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background: var(--color-danger);
}

/* Main content layout */
.lightbox-content {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* Image area (left side) */
.image-area {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg-base);
}

.image-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 1rem;
  position: relative;
}

.image-display img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
}

.image-display.protected img {
  filter: blur(50px);
}

/* Protection overlay */
.protection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-darker);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.protection-content {
  text-align: center;
  color: var(--color-text-primary);
  padding: 2rem;
  max-width: 400px;
}

.protection-content i.fa-lock {
  font-size: 3rem;
  color: var(--color-info);
  margin-bottom: 1rem;
}

.protection-content h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.protection-content p {
  margin: 0 0 1.5rem 0;
  color: var(--color-text-tertiary);
  font-size: 1rem;
  line-height: 1.5;
}

.btn-unlock {
  background: var(--color-info);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-unlock:hover {
  background: var(--color-info-hover);
  transform: translateY(-1px);
}

/* Filmstrip */
.filmstrip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
}

.filmstrip-nav {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.75rem;
}

.filmstrip-nav:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-light);
}

.filmstrip-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.filmstrip-track {
  flex: 1;
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.filmstrip-track::-webkit-scrollbar {
  display: none;
}

.filmstrip-thumb {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  opacity: 0.5;
  transition: all 0.15s;
}

.filmstrip-thumb:hover {
  opacity: 0.8;
}

.filmstrip-thumb.active {
  border-color: var(--color-primary);
  opacity: 1;
}

.filmstrip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Inspector Sidebar */
.inspector-sidebar {
  width: 320px;
  min-width: 320px;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inspector-content {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.inspector-content::-webkit-scrollbar {
  width: 6px;
}

.inspector-content::-webkit-scrollbar-track {
  background: transparent;
}

.inspector-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.inspector-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-light);
}

/* Prompt display */
.prompt-display {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-primary);
}

.prompt-display p {
  margin: 0;
  word-break: break-word;
}

.prompt-display.negative {
  color: var(--color-text-tertiary);
}

.no-data {
  color: var(--color-text-tertiary);
  font-size: 0.8125rem;
  font-style: italic;
  margin: 0;
}

/* Model info */
.model-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.75rem;
}

.model-label {
  color: var(--color-text-tertiary);
  font-size: 0.8125rem;
}

.model-name {
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

/* LoRAs list */
.loras-list,
.tis-list {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.loras-header,
.tis-header {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.lora-item,
.ti-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.25rem 0;
  font-size: 0.8125rem;
}

.lora-name,
.ti-name {
  color: var(--color-text-primary);
  word-break: break-word;
  flex: 1;
  padding-right: 0.5rem;
}

.lora-strength,
.ti-strength {
  color: var(--color-text-tertiary);
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* Action buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-row {
  display: flex;
  gap: 0.5rem;
}

.action-row .btn-action {
  flex: 1;
}

.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}

.btn-action i {
  font-size: 0.8125rem;
}

/* Primary button style */
.btn-primary {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-primary);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

/* Secondary button style (gray) */
.btn-secondary {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-border);
  border-color: var(--color-border-light);
}

/* Active state for favorite button */
.btn-secondary.active {
  background: var(--color-warning);
  color: var(--color-bg-base);
  border-color: var(--color-warning);
}

.btn-secondary.active:hover {
  background: var(--color-warning-hover);
  border-color: var(--color-warning-hover);
}

/* Active state for hide button */
.btn-secondary.active-hide {
  background: var(--color-text-disabled);
  color: var(--color-text-primary);
  border-color: var(--color-text-disabled);
}

.btn-secondary.active-hide:hover {
  background: var(--color-text-tertiary);
  border-color: var(--color-text-tertiary);
}

/* Delete button (danger) */
.btn-delete {
  background: var(--color-danger);
  color: white;
  border: 1px solid var(--color-danger);
}

.btn-delete:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

/* Details overlay */
.request-details-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-surface);
  z-index: 25;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
}

.request-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.request-details-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-copy {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.5rem 0.875rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-copy:hover {
  background: var(--color-primary-hover);
}

.btn-copy i.fa-check {
  color: var(--color-success);
}

.btn-close-details {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close-details:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.request-details-body {
  flex: 1;
  overflow: auto;
  background: var(--color-bg-base);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.request-details-body pre {
  margin: 0;
  color: var(--color-success);
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Responsive */
@media (max-width: 1024px) {
  .lightbox-content {
    flex-direction: column;
  }

  .inspector-sidebar {
    width: 100%;
    min-width: 100%;
    max-height: 45vh;
    border-left: none;
    border-top: 1px solid var(--color-border);
  }

  .image-area {
    flex: 1;
    min-height: 40vh;
  }
}

@media (max-width: 640px) {
  .lightbox-overlay {
    padding: 0;
  }

  .lightbox-container {
    border-radius: 0;
    height: 100vh;
    max-height: 100vh;
  }

  .inspector-sidebar {
    max-height: 50vh;
  }

  .filmstrip-thumb {
    width: 44px;
    height: 44px;
  }

  .btn-close {
    top: 0.5rem;
    right: 0.5rem;
  }
}
</style>
