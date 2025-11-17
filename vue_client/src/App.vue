<template>
  <div class="app">
    <router-view />

    <RequestGeneratorModal
      v-if="showRequestModal"
      ref="requestModalRef"
      :initialSettings="modalInitialSettings"
      :includeSeed="modalIncludeSeed"
      @close="handleCloseRequestModal"
      @submit="handleNewRequest"
    />

    <SettingsModal
      v-if="showSettingsModal"
      @close="showSettingsModal = false"
    />
  </div>
</template>

<script>
import { ref, provide, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import RequestGeneratorModal from './components/RequestGeneratorModal.vue'
import SettingsModal from './components/SettingsModal.vue'

export default {
  name: 'App',
  components: {
    RequestGeneratorModal,
    SettingsModal
  },
  setup() {
    const showRequestModal = ref(false)
    const showSettingsModal = ref(false)
    const requestModalRef = ref(null)
    const modalInitialSettings = ref(null)
    const modalIncludeSeed = ref(false)
    const shouldOpenRequestsPanel = ref(false)

    const handleCloseRequestModal = () => {
      showRequestModal.value = false
      // Clear the initial settings when modal closes
      modalInitialSettings.value = null
      modalIncludeSeed.value = false
    }

    const handleNewRequest = () => {
      handleCloseRequestModal()
      // Signal to open the requests panel
      shouldOpenRequestsPanel.value = true
    }

    const openRequestModal = () => {
      showRequestModal.value = true
    }

    const openSettingsModal = () => {
      showSettingsModal.value = true
    }

    const loadSettingsFromImage = async (image, includeSeed = false) => {
      if (!image.full_request) {
        console.error('No settings available for this image')
        return
      }

      try {
        const settings = JSON.parse(image.full_request)

        // If including seed, get it from the full_response
        if (includeSeed && image.full_response) {
          try {
            const response = JSON.parse(image.full_response)
            if (response.seed) {
              // Add seed to params
              if (!settings.params) {
                settings.params = {}
              }
              settings.params.seed = response.seed
            }
          } catch (responseError) {
            console.error('Error parsing full_response:', responseError)
          }
        }

        // Set the initial settings and show the modal
        modalInitialSettings.value = settings
        modalIncludeSeed.value = includeSeed
        showRequestModal.value = true
      } catch (error) {
        console.error('Error loading settings from image:', error)
      }
    }

    // Provide functions to child components
    provide('loadSettingsFromImage', loadSettingsFromImage)
    provide('openRequestModal', openRequestModal)
    provide('openSettingsModal', openSettingsModal)
    provide('shouldOpenRequestsPanel', shouldOpenRequestsPanel)

    return {
      showRequestModal,
      showSettingsModal,
      requestModalRef,
      modalInitialSettings,
      modalIncludeSeed,
      handleCloseRequestModal,
      handleNewRequest,
      loadSettingsFromImage
    }
  }
}
</script>

<style>
.app {
  min-height: 100vh;
}
</style>
