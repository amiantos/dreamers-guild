<template>
  <div class="accordion-section" :class="{ open: isOpen }">
    <button class="accordion-header" @click="toggle" type="button">
      <div class="accordion-title">
        <i v-if="icon" :class="['fa-solid', icon]"></i>
        <span>{{ title }}</span>
      </div>
      <i class="fa-solid fa-chevron-down accordion-chevron"></i>
    </button>
    <div v-show="isOpen" class="accordion-body">
      <slot></slot>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'AccordionSection',
  props: {
    title: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: ''
    },
    defaultOpen: {
      type: Boolean,
      default: false
    },
    forceOpen: {
      type: Boolean,
      default: null
    }
  },
  setup(props) {
    const isOpen = ref(props.forceOpen !== null ? props.forceOpen : props.defaultOpen)

    // Watch for forceOpen changes (e.g., when screen size changes)
    watch(() => props.forceOpen, (newValue) => {
      if (newValue !== null) {
        isOpen.value = newValue
      }
    })

    const toggle = () => {
      isOpen.value = !isOpen.value
    }

    return {
      isOpen,
      toggle
    }
  }
}
</script>

<style scoped>
.accordion-section {
  border-bottom: 1px solid var(--color-border);
}

.accordion-section:last-child {
  border-bottom: none;
}

.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.accordion-header:hover {
  background: var(--color-surface-hover);
}

.accordion-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.accordion-title i {
  width: 14px;
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
  text-align: center;
}

.accordion-chevron {
  font-size: 0.625rem;
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
}

.accordion-section.open .accordion-chevron {
  transform: rotate(180deg);
}

.accordion-body {
  padding: 0 1rem 0.875rem;
}
</style>
