import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Gallery Store - Centralized state management for image gallery
 *
 * Note: This store provides the foundation for centralized gallery state.
 * Currently, LibraryView.vue still manages its own image loading and filtering
 * due to the complexity of the route-based filtering logic. This store is
 * designed to be incrementally adopted as we refactor.
 */
export const useGalleryStore = defineStore('gallery', () => {
  // Core image state
  const images = ref([])
  const totalCount = ref(0)
  const loading = ref(false)
  const hasMore = ref(true)
  const offset = ref(0)

  // Selected image for modal
  const selectedImage = ref(null)
  const routeBeforeModal = ref(null)

  // Filter state
  const filters = ref({
    requestId: null,
    keywords: [],
    filterCriteria: []
  })

  // Multi-select mode state
  const isMultiSelectMode = ref(false)
  const selectedImages = ref(new Set())
  const lastSelectedIndex = ref(-1)

  // Computed
  const selectedCount = computed(() => selectedImages.value.size)

  const hasFilters = computed(() => {
    return filters.value.requestId !== null ||
           filters.value.keywords.length > 0 ||
           filters.value.filterCriteria.length > 0
  })

  const currentImageIndex = computed(() => {
    if (!selectedImage.value) return -1
    return images.value.findIndex(img => img.uuid === selectedImage.value.uuid)
  })

  const canNavigatePrev = computed(() => currentImageIndex.value > 0)
  const canNavigateNext = computed(() => currentImageIndex.value < images.value.length - 1)

  /**
   * Set images array
   * @param {Array} newImages - Images to set
   * @param {boolean} append - Whether to append to existing images
   */
  const setImages = (newImages, append = false) => {
    if (append) {
      images.value = [...images.value, ...newImages]
    } else {
      images.value = newImages
    }
  }

  /**
   * Update a single image in the array
   * @param {string} uuid - Image UUID
   * @param {Object} updates - Partial update object
   */
  const updateImage = (uuid, updates) => {
    const index = images.value.findIndex(img => img.uuid === uuid)
    if (index > -1) {
      images.value[index] = { ...images.value[index], ...updates }
    }
    // Also update selected image if it's the same
    if (selectedImage.value?.uuid === uuid) {
      selectedImage.value = { ...selectedImage.value, ...updates }
    }
  }

  /**
   * Remove an image from the array
   * @param {string} uuid - Image UUID to remove
   */
  const removeImage = (uuid) => {
    images.value = images.value.filter(img => img.uuid !== uuid)
    if (selectedImage.value?.uuid === uuid) {
      selectedImage.value = null
    }
    selectedImages.value.delete(uuid)
  }

  /**
   * Remove multiple images from the array
   * @param {Array<string>} uuids - Array of image UUIDs to remove
   */
  const removeImages = (uuids) => {
    const uuidSet = new Set(uuids)
    images.value = images.value.filter(img => !uuidSet.has(img.uuid))
    if (selectedImage.value && uuidSet.has(selectedImage.value.uuid)) {
      selectedImage.value = null
    }
    uuids.forEach(uuid => selectedImages.value.delete(uuid))
  }

  /**
   * Select an image for modal viewing
   * @param {Object} image - Image to select
   */
  const selectImage = (image) => {
    selectedImage.value = image
  }

  /**
   * Close the selected image modal
   */
  const closeImage = () => {
    selectedImage.value = null
  }

  /**
   * Navigate to previous image
   */
  const navigatePrev = () => {
    if (!canNavigatePrev.value) return
    selectedImage.value = images.value[currentImageIndex.value - 1]
  }

  /**
   * Navigate to next image
   */
  const navigateNext = () => {
    if (!canNavigateNext.value) return
    selectedImage.value = images.value[currentImageIndex.value + 1]
  }

  /**
   * Toggle multi-select mode
   */
  const toggleMultiSelectMode = () => {
    isMultiSelectMode.value = !isMultiSelectMode.value
    if (!isMultiSelectMode.value) {
      clearSelection()
    }
  }

  /**
   * Toggle selection of an image
   * @param {string} uuid - Image UUID
   */
  const toggleSelection = (uuid) => {
    if (selectedImages.value.has(uuid)) {
      selectedImages.value.delete(uuid)
    } else {
      selectedImages.value.add(uuid)
    }
  }

  /**
   * Clear all selected images
   */
  const clearSelection = () => {
    selectedImages.value.clear()
    lastSelectedIndex.value = -1
  }

  /**
   * Set filter criteria
   * @param {Object} newFilters - Filter object
   */
  const setFilters = (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  }

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    filters.value = {
      requestId: null,
      keywords: [],
      filterCriteria: []
    }
  }

  /**
   * Reset pagination for new query
   */
  const resetPagination = () => {
    offset.value = 0
    hasMore.value = true
  }

  /**
   * Clear all gallery state
   */
  const clearState = () => {
    images.value = []
    totalCount.value = 0
    loading.value = false
    hasMore.value = true
    offset.value = 0
    selectedImage.value = null
    routeBeforeModal.value = null
    filters.value = {
      requestId: null,
      keywords: [],
      filterCriteria: []
    }
    isMultiSelectMode.value = false
    selectedImages.value.clear()
    lastSelectedIndex.value = -1
  }

  return {
    // State
    images,
    totalCount,
    loading,
    hasMore,
    offset,
    selectedImage,
    routeBeforeModal,
    filters,
    isMultiSelectMode,
    selectedImages,
    lastSelectedIndex,
    // Computed
    selectedCount,
    hasFilters,
    currentImageIndex,
    canNavigatePrev,
    canNavigateNext,
    // Actions
    setImages,
    updateImage,
    removeImage,
    removeImages,
    selectImage,
    closeImage,
    navigatePrev,
    navigateNext,
    toggleMultiSelectMode,
    toggleSelection,
    clearSelection,
    setFilters,
    clearFilters,
    resetPagination,
    clearState
  }
})
