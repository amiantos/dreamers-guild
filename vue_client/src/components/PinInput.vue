<template>
  <div class="pin-input-container" @click="focus">
    <div class="pin-dots">
      <div
        v-for="(digit, index) in 4"
        :key="index"
        class="pin-dot"
        :class="{ filled: pin.length > index, active: pin.length === index }"
      >
        <div v-if="pin.length > index" class="dot"></div>
      </div>
    </div>
    <input
      ref="hiddenInput"
      type="tel"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="4"
      class="pin-hidden-input"
      v-model="pin"
      @input="handleInput"
      @keydown="handleKeydown"
      autocomplete="off"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  autofocus: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue', 'complete']);

const pin = ref(props.modelValue);
const hiddenInput = ref(null);

watch(() => props.modelValue, (newValue) => {
  pin.value = newValue;
});

watch(pin, (newValue) => {
  emit('update:modelValue', newValue);
  if (newValue.length === 4) {
    emit('complete', newValue);
  }
});

const handleInput = (e) => {
  // Only allow digits
  pin.value = e.target.value.replace(/\D/g, '');
};

const handleKeydown = (e) => {
  // Allow: backspace, delete, tab, escape, enter
  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter'].includes(e.key)) {
    return;
  }
  // Ensure only digits are allowed
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
};

const focus = () => {
  hiddenInput.value?.focus();
};

const clear = () => {
  pin.value = '';
};

onMounted(() => {
  if (props.autofocus) {
    focus();
  }
});

defineExpose({ focus, clear });
</script>

<style scoped>
.pin-input-container {
  position: relative;
  display: inline-block;
}

.pin-dots {
  display: flex;
  gap: 16px;
  cursor: text;
}

.pin-dot {
  width: 60px;
  height: 60px;
  border: 2px solid #333;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0f0f0f;
  transition: all 0.2s ease;
}

.pin-dot.active {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.pin-dot.filled {
  border-color: #007bff;
}

.dot {
  width: 16px;
  height: 16px;
  background-color: #fff;
  border-radius: 50%;
}

.pin-hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  font-size: 16px; /* Prevents zoom on mobile */
  border: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: transparent;
  cursor: pointer;
}

/* Focus on container to focus hidden input */
.pin-input-container:focus-within .pin-dot.active {
  border-color: var(--primary-color, #007bff);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}
</style>
