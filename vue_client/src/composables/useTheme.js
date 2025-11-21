/**
 * Theme Management Composable
 *
 * Provides functionality to toggle between dark and light themes.
 * Theme preference is persisted to localStorage and applied to the document root.
 */

import { ref, watch, onMounted } from 'vue'

const STORAGE_KEY = 'theme-preference'
const DARK_THEME = 'dark'
const LIGHT_THEME = 'light'

// Shared state across all component instances
const currentTheme = ref(DARK_THEME)

export function useTheme() {
  /**
   * Initialize theme from localStorage or system preference
   */
  const initializeTheme = () => {
    // Check localStorage first
    const savedTheme = localStorage.getItem(STORAGE_KEY)

    if (savedTheme === DARK_THEME || savedTheme === LIGHT_THEME) {
      currentTheme.value = savedTheme
    } else {
      // Fall back to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      currentTheme.value = prefersDark ? DARK_THEME : LIGHT_THEME
    }

    applyTheme(currentTheme.value)
  }

  /**
   * Apply theme to the document
   */
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
  }

  /**
   * Toggle between dark and light themes
   */
  const toggleTheme = () => {
    currentTheme.value = currentTheme.value === DARK_THEME ? LIGHT_THEME : DARK_THEME
  }

  /**
   * Set a specific theme
   */
  const setTheme = (theme) => {
    if (theme === DARK_THEME || theme === LIGHT_THEME) {
      currentTheme.value = theme
    }
  }

  /**
   * Get current theme
   */
  const getTheme = () => {
    return currentTheme.value
  }

  /**
   * Check if dark theme is active
   */
  const isDark = () => {
    return currentTheme.value === DARK_THEME
  }

  /**
   * Check if light theme is active
   */
  const isLight = () => {
    return currentTheme.value === LIGHT_THEME
  }

  // Watch for theme changes and persist + apply them
  watch(currentTheme, (newTheme) => {
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  })

  // Initialize on mount
  onMounted(() => {
    initializeTheme()
  })

  // Also allow manual initialization for components that need it early
  // (e.g., in App.vue before mount)
  if (typeof window !== 'undefined' && !document.documentElement.hasAttribute('data-theme')) {
    initializeTheme()
  }

  return {
    currentTheme,
    toggleTheme,
    setTheme,
    getTheme,
    isDark,
    isLight,
    initializeTheme,
    DARK_THEME,
    LIGHT_THEME
  }
}
