import { ref, readonly } from 'vue'

// Shared toast state
const toasts = ref([])
let toastId = 0

/**
 * Composable for showing toast notifications
 * Usage:
 *   const { showToast } = useToast()
 *   showToast('Message', 'success') // types: 'success', 'error', 'info', 'warning'
 */
export function useToast() {
  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
   * @param {number} duration - Duration in ms (default: 3000, 0 = persistent)
   */
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = ++toastId
    const toast = { id, message, type }
    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  /**
   * Remove a specific toast by ID
   * @param {number} id - Toast ID to remove
   */
  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  /**
   * Clear all toasts
   */
  const clearToasts = () => {
    toasts.value = []
  }

  return {
    toasts: readonly(toasts),
    showToast,
    removeToast,
    clearToasts
  }
}
