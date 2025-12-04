import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * UI Store - Centralized state management for UI elements
 * Manages sidebar, modals, panels, and responsive state
 */
export const useUiStore = defineStore('ui', () => {
  // Responsive state
  const isMobile = ref(window.innerWidth < 1024)

  // Sidebar state - single source of truth (was duplicated in LibraryView and LibrarySidebar)
  const getInitialSidebarState = () => {
    const savedState = localStorage.getItem('sidebarCollapsed')
    if (savedState !== null) {
      return savedState === 'true'
    }
    return window.innerWidth < 1024
  }
  const sidebarCollapsed = ref(getInitialSidebarState())

  // Requests panel state
  const isPanelOpen = ref(false)

  // Menu dropdown state
  const showMenu = ref(false)

  // Modal visibility state
  const modals = ref({
    createAlbum: false,
    addToAlbum: false,
    batchDelete: false,
    deleteRequest: false,
    deleteAllRequests: false
  })

  // Computed
  const isAnySidebarVisible = computed(() => !sidebarCollapsed.value || isPanelOpen.value)

  /**
   * Toggle sidebar collapsed state
   */
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.value)
  }

  /**
   * Set sidebar collapsed state explicitly
   * @param {boolean} collapsed - Whether sidebar should be collapsed
   */
  const setSidebarCollapsed = (collapsed) => {
    sidebarCollapsed.value = collapsed
    localStorage.setItem('sidebarCollapsed', collapsed)
  }

  /**
   * Toggle requests panel
   */
  const togglePanel = () => {
    isPanelOpen.value = !isPanelOpen.value
  }

  /**
   * Open requests panel
   */
  const openPanel = () => {
    isPanelOpen.value = true
  }

  /**
   * Close requests panel
   */
  const closePanel = () => {
    isPanelOpen.value = false
  }

  /**
   * Toggle menu dropdown
   */
  const toggleMenu = () => {
    showMenu.value = !showMenu.value
  }

  /**
   * Close menu dropdown
   */
  const closeMenu = () => {
    showMenu.value = false
  }

  /**
   * Open a specific modal
   * @param {string} modalName - Name of the modal to open
   */
  const openModal = (modalName) => {
    if (modalName in modals.value) {
      modals.value[modalName] = true
    }
  }

  /**
   * Close a specific modal
   * @param {string} modalName - Name of the modal to close
   */
  const closeModal = (modalName) => {
    if (modalName in modals.value) {
      modals.value[modalName] = false
    }
  }

  /**
   * Close all modals
   */
  const closeAllModals = () => {
    Object.keys(modals.value).forEach(key => {
      modals.value[key] = false
    })
  }

  /**
   * Handle window resize
   * Updates mobile state and auto-collapses sidebar on mobile
   */
  const handleResize = () => {
    isMobile.value = window.innerWidth < 1024
    // Auto-collapse on mobile if not explicitly set
    if (isMobile.value && !localStorage.getItem('sidebarCollapsed')) {
      sidebarCollapsed.value = true
    }
  }

  /**
   * Initialize resize listener
   * Call in App.vue onMounted
   */
  const initResizeListener = () => {
    window.addEventListener('resize', handleResize)
  }

  /**
   * Cleanup resize listener
   * Call in App.vue onUnmounted
   */
  const cleanupResizeListener = () => {
    window.removeEventListener('resize', handleResize)
  }

  return {
    // State
    isMobile,
    sidebarCollapsed,
    isPanelOpen,
    showMenu,
    modals,
    // Computed
    isAnySidebarVisible,
    // Actions
    toggleSidebar,
    setSidebarCollapsed,
    togglePanel,
    openPanel,
    closePanel,
    toggleMenu,
    closeMenu,
    openModal,
    closeModal,
    closeAllModals,
    handleResize,
    initResizeListener,
    cleanupResizeListener
  }
})
