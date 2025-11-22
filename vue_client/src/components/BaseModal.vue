<template>
  <div
    v-if="show"
    class="modal-overlay"
    :class="overlayClass"
    @click.self="handleBackdropClick"
  >
    <div
      class="modal-content"
      :class="[contentClass, sizeClass]"
    >
      <button
        v-if="showClose"
        class="btn-close"
        @click="$emit('close')"
        :title="closeTitle"
      >
        ×
      </button>

      <slot></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BaseModal',
  props: {
    show: {
      type: Boolean,
      default: true
    },
    closeOnBackdrop: {
      type: Boolean,
      default: true
    },
    showClose: {
      type: Boolean,
      default: true
    },
    closeTitle: {
      type: String,
      default: 'Close'
    },
    size: {
      type: String,
      default: 'medium', // small, medium, large, xlarge, full
      validator: (value) => ['small', 'medium', 'large', 'xlarge', 'full'].includes(value)
    },
    overlayClass: {
      type: String,
      default: ''
    },
    contentClass: {
      type: String,
      default: ''
    }
  },
  emits: ['close'],
  computed: {
    sizeClass() {
      return `modal-size-${this.size}`
    }
  },
  methods: {
    handleBackdropClick() {
      if (this.closeOnBackdrop) {
        this.$emit('close')
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-modal-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal);
  padding: 2rem;
}

.modal-content {
  position: relative;
  background: var(--color-modal-content);
  border-radius: 12px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

/* Size variants */
.modal-size-small {
  max-width: 400px;
}

.modal-size-medium {
  max-width: 600px;
}

.modal-size-large {
  max-width: 900px;
}

.modal-size-xlarge {
  max-width: 1200px;
}

.modal-size-full {
  max-width: 95vw;
  max-height: 95vh;
}

.btn-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
  z-index: var(--z-index-modal-close);
}

.btn-close:hover {
  color: var(--color-text-primary);
}
</style>
