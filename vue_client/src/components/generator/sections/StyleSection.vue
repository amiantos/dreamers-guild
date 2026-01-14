<template>
  <div class="style-section-wrapper">
    <InlineStylePicker
      ref="inlineStylePickerRef"
      :current-style="selectedStyleName"
      @select="onStyleSelect"
      @stylesLoaded="onStylesLoaded"
    />
  </div>
</template>

<script setup>
import { inject, ref, onMounted } from 'vue'
import { GeneratorFormKey } from '../composables/useGeneratorForm.js'
import InlineStylePicker from '../../InlineStylePicker.vue'

const {
  selectedStyleName,
  inlineStylePicker,
  onStyleSelect,
  onStylesLoaded
} = inject(GeneratorFormKey)

const inlineStylePickerRef = ref(null)

// Sync the ref to the parent form composable
onMounted(() => {
  inlineStylePicker.value = inlineStylePickerRef.value
})
</script>

<style scoped>
.style-section-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
</style>
